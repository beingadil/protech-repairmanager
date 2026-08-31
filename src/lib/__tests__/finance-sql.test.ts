/**
 * Finance v2 SQL regression suite.
 *
 * Runs the EXACT production migration (app/shared/financeSchema.ts) and the
 * renderer op-builders (src/lib/finance.ts buildVoucherOps + derivation SQL)
 * against an in-memory better-sqlite3 database — no Electron, no IPC.
 */
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { FINANCE_SCHEMA, backfillFinanceV2, BACKFILL_FLAG } from '../../../app/shared/financeSchema';
import { buildVoucherOps, deriveJobPaymentStatusOp } from '../finance';
import type { PostVoucherInput } from '../finance';

function makeDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Legacy schema (mirrors app/main/database.ts MIGRATIONS + safe ALTERs)
  db.exec(`
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mobile TEXT DEFAULT '',
      address TEXT DEFAULT '',
      party_type TEXT DEFAULT 'customer',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      job_type TEXT NOT NULL DEFAULT 'laptop',
      serial_no TEXT, model TEXT, ram TEXT, hard TEXT, processor TEXT, symptoms TEXT,
      receive_date TEXT NOT NULL,
      return_date TEXT,
      charges REAL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      has_charger INTEGER NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'due',
      deliver_status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      reference_token TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE TABLE financial_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      category TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      customer_id INTEGER,
      customer_name TEXT,
      supplier_name TEXT,
      reference_job_id INTEGER,
      token_number TEXT,
      description TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO customers (name, mobile, party_type) VALUES ('Ali', '0300', 'customer');
    INSERT INTO customers (name, mobile, party_type) VALUES ('Market Parts Co', '0301', 'supplier');
    INSERT INTO jobs (token_number, customer_id, receive_date, charges, discount, payment_status)
      VALUES ('PTS-901', 1, '2026-08-20', 3000, 0, 'due');
  `);

  // Production finance-v2 schema + backfill
  db.exec(FINANCE_SCHEMA);
  return db;
}

/** Execute the op arrays exactly like the IPC batch() does. */
function runOps(db: Database.Database, ops: Array<{ sql: string; params?: unknown[] }>): unknown[] {
  const results: unknown[] = [];
  const tx = db.transaction(() => {
    for (const op of ops) {
      const stmt = db.prepare(op.sql);
      const args = Array.isArray(op.params) ? op.params : [];
      if (op.sql.trimStart().toUpperCase().startsWith('SELECT')) {
        results.push(args.length ? stmt.all(...args) : stmt.all());
      } else {
        const info = args.length ? stmt.run(...args) : stmt.run();
        results.push({ changes: info.changes, lastInsertRowid: Number(info.lastInsertRowid) });
      }
    }
  });
  tx();
  return results;
}

function postReceipt(db: Database.Database, overrides: Partial<PostVoucherInput> = {}) {
  const input: PostVoucherInput = {
    date: '2026-08-31',
    type: 'receipt',
    amount: 1500,
    categoryAccountCode: 3000,
    paymentAccountCode: 1000,
    partyCustomerId: 1,
    referenceJobId: 1,
    referenceToken: 'PTS-901',
    description: 'Repair charges for PTS-901',
    notes: null,
    ...overrides
  };
  const acct = (code: number) =>
    (db.prepare('SELECT id FROM accounts WHERE code = ?').get(code) as { id: number }).id;
  // Unique voucher_no per call (production uses the collision-safe counter).
  const seq = (db.prepare('SELECT COUNT(*) AS c FROM vouchers').get() as { c: number }).c + 900001;
  const voucherNo = `VCH-${seq}`;
  const ops = buildVoucherOps(input, {
    voucherNo,
    payAcctId: acct(input.paymentAccountCode),
    catAcctId: acct(input.categoryAccountCode),
    partyName: 'Ali'
  });
  runOps(db, ops);
}

describe('finance v2 schema + backfill', () => {
  it('seeds the chart of accounts with 15 accounts and payment flags', () => {
    const db = makeDb();
    const accounts = db.prepare('SELECT * FROM accounts ORDER BY code').all() as Array<{
      code: number;
      is_payment_account: number;
      type: string;
    }>;
    expect(accounts.length).toBe(15);
    expect(accounts.filter((a) => a.is_payment_account === 1).map((a) => a.code)).toEqual([
      1000, 1010, 1020, 1030
    ]);
    expect(accounts.find((a) => a.code === 3000)?.type).toBe('income');
    expect(accounts.find((a) => a.code === 4100)?.type).toBe('expense');
  });

  it('backfill converts legacy rows into balanced vouchers with provenance', () => {
    const db = makeDb();
    db.prepare(
      `INSERT INTO financial_transactions (date, type, amount, category, payment_method,
         customer_name, token_number, description)
       VALUES ('2026-08-01', 'credit', 2500, 'repair_income', 'jazzcash', 'Ali', 'PTS-901', 'Repair payment')`
    ).run();
    db.prepare(
      `INSERT INTO financial_transactions (date, type, amount, category, payment_method,
         supplier_name, description)
       VALUES ('2026-08-02', 'debit', 800, 'market_supplier_payment', 'cash', 'Market Parts Co', 'Parts purchase')`
    ).run();

    backfillFinanceV2(db);

    const vouchers = db.prepare('SELECT * FROM vouchers ORDER BY id').all() as Array<{
      id: number;
      voucher_no: string;
      type: string;
      legacy_tx_id: number;
      party_customer_id: number | null;
      party_supplier_name: string | null;
    }>;
    expect(vouchers.length).toBe(2);

    // Receipt: party resolved by name → customer 1; supplier null
    expect(vouchers[0].voucher_no).toBe('VCH-000001');
    expect(vouchers[0].type).toBe('receipt');
    expect(vouchers[0].legacy_tx_id).toBe(1);
    expect(vouchers[0].party_customer_id).toBe(1);

    // Payment: supplier had no customers row match by id, falls to name label
    expect(vouchers[1].type).toBe('payment');
    expect(vouchers[1].legacy_tx_id).toBe(2);

    // Balanced lines: 2 per voucher, debit sum == credit sum
    for (const v of vouchers) {
      const bal = db
        .prepare('SELECT SUM(debit) AS d, SUM(credit) AS c FROM voucher_lines WHERE voucher_id = ?')
        .get(v.id) as { id: number; d: number; c: number } & { d: number; c: number };
      expect(bal.d).toBe(bal.c);
      expect(bal.d).toBeGreaterThan(0);
    }

    // Receipt lines hit the right accounts: JazzCash debit, Repair Income credit
    const receiptLines = db
      .prepare(
        `SELECT a.code, vl.debit, vl.credit FROM voucher_lines vl
         JOIN accounts a ON a.id = vl.account_id WHERE vl.voucher_id = ?`
      )
      .all(vouchers[0].id) as Array<{ code: number; debit: number; credit: number }>;
    const jazz = receiptLines.find((l) => l.code === 1020);
    const income = receiptLines.find((l) => l.code === 3000);
    expect(jazz?.debit).toBe(2500);
    expect(income?.credit).toBe(2500);

    // Flag set → backfill is a no-op on second run
    expect((db.prepare('SELECT value FROM settings WHERE key = ?').get(BACKFILL_FLAG) as { value: string }).value).toBe('1');
    backfillFinanceV2(db);
    expect((db.prepare('SELECT COUNT(*) AS c FROM vouchers').get() as { c: number }).c).toBe(2);
  });

  it('backfill advances voucher counter past non-contiguous legacy ids (MAX not COUNT)', () => {
    const db = makeDb();
    const insert = db.prepare(
      `INSERT INTO financial_transactions (date, type, amount, category, payment_method, description)
       VALUES ('2026-08-01', 'credit', 100, 'other_income', 'cash', 'x')`
    );
    insert.run();
    insert.run();
    insert.run();
    db.prepare('DELETE FROM financial_transactions WHERE id = 2').run();
    db.prepare('DELETE FROM financial_transactions WHERE id = 3').run();
    // One row remains at id=1, but ids went up to 3.
    insert.run();
    insert.run(); // now ids 1, 4, 5 (sqlite keeps sequence)

    backfillFinanceV2(db);
    const counter = db
      .prepare("SELECT value FROM settings WHERE key = 'voucher_counter'")
      .get() as { value: string };
    expect(Number(counter.value)).toBeGreaterThanOrEqual(5);
  });
});

describe('voucher posting via buildVoucherOps', () => {
  it('posts a balanced receipt, mirrors legacy row, and derives job status', () => {
    const db = makeDb();
    postReceipt(db, { amount: 3000 });

    // Voucher + 2 balanced lines
    const voucher = db
      .prepare('SELECT * FROM vouchers WHERE voucher_no = ?')
      .get('VCH-900001') as { id: number; type: string; party_customer_id: number };
    expect(voucher.type).toBe('receipt');
    expect(voucher.party_customer_id).toBe(1);
    const bal = db
      .prepare('SELECT SUM(debit) AS d, SUM(credit) AS c FROM voucher_lines WHERE voucher_id = ?')
      .get(voucher.id) as unknown as { d: number; c: number };
    expect(bal.d).toBe(3000);
    expect(bal.c).toBe(3000);

    // Lines carry the job reference
    const line = db
      .prepare('SELECT * FROM voucher_lines WHERE voucher_id = ?')
      .get(voucher.id) as { reference_token: string; reference_job_id: number };
    expect(line.reference_token).toBe('PTS-901');
    expect(line.reference_job_id).toBe(1);

    // Legacy mirror exists with the category + method mapped from account codes
    const mirror = db
      .prepare('SELECT * FROM financial_transactions ORDER BY id DESC LIMIT 1')
      .get() as { type: string; amount: number; category: string; payment_method: string; token_number: string };
    expect(mirror.type).toBe('credit');
    expect(mirror.amount).toBe(3000);
    expect(mirror.category).toBe('repair_income');
    expect(mirror.payment_method).toBe('cash');
    expect(mirror.token_number).toBe('PTS-901');

    // Full payment flips the job to paid
    const job = db.prepare("SELECT payment_status FROM jobs WHERE token_number = 'PTS-901'").get() as {
      payment_status: string;
    };
    expect(job.payment_status).toBe('paid');
  });

  it('partial payment keeps job DUE; second payment flips to PAID', () => {
    const db = makeDb();
    postReceipt(db, { amount: 1500 });
    let job = db.prepare("SELECT payment_status FROM jobs WHERE token_number = 'PTS-901'").get() as {
      payment_status: string;
    };
    expect(job.payment_status).toBe('due');

    postReceipt(db, { amount: 1500, description: 'Final payment' });
    job = db.prepare("SELECT payment_status FROM jobs WHERE token_number = 'PTS-901'").get() as {
      payment_status: string;
    };
    expect(job.payment_status).toBe('paid');
  });

  it('discount + credits >= charges flips to PAID (discount honoured)', () => {
    const db = makeDb();
    db.prepare("UPDATE jobs SET discount = 500 WHERE token_number = 'PTS-901'").run();
    postReceipt(db, { amount: 2500 });
    const job = db.prepare("SELECT payment_status FROM jobs WHERE token_number = 'PTS-901'").get() as {
      payment_status: string;
    };
    expect(job.payment_status).toBe('paid');
  });

  it('posts a balanced payment voucher for supplier payouts', () => {
    const db = makeDb();
    const input: PostVoucherInput = {
      date: '2026-08-31',
      type: 'payment',
      amount: 1200,
      categoryAccountCode: 4010,
      paymentAccountCode: 1020,
      partySupplierName: 'Market Parts Co',
      description: 'Monthly parts settlement',
      notes: null
    };
    const acct = (code: number) =>
      (db.prepare('SELECT id FROM accounts WHERE code = ?').get(code) as { id: number }).id;
    const ops = buildVoucherOps(input, {
      voucherNo: 'VCH-900002',
      payAcctId: acct(1020),
      catAcctId: acct(4010),
      partyName: null
    });
    runOps(db, ops);

    const voucher = db.prepare('SELECT * FROM vouchers WHERE voucher_no = ?').get('VCH-900002') as {
      type: string;
      party_supplier_name: string;
    };
    expect(voucher.type).toBe('payment');
    expect(voucher.party_supplier_name).toBe('Market Parts Co');

    const lines = db
      .prepare(
        `SELECT a.code, vl.debit, vl.credit FROM voucher_lines vl
         JOIN accounts a ON a.id = vl.account_id WHERE vl.voucher_id = (SELECT id FROM vouchers WHERE voucher_no = 'VCH-900002')`
      )
      .all() as Array<{ code: number; debit: number; credit: number }>;
    // Supplier Payments debited, JazzCash credited
    expect(lines.find((l) => l.code === 4010)?.debit).toBe(1200);
    expect(lines.find((l) => l.code === 1020)?.credit).toBe(1200);

    // Legacy mirror is a debit with the supplier name
    const mirror = db
      .prepare('SELECT * FROM financial_transactions ORDER BY id DESC LIMIT 1')
      .get() as { type: string; supplier_name: string };
    expect(mirror.type).toBe('debit');
    expect(mirror.supplier_name).toBe('Market Parts Co');
  });

  it('invoice status derives from allocated receipt lines (issued → partial → paid)', () => {
    const db = makeDb();
    // Create an invoice for the job (production createInvoiceFromJob SQL shape)
    db.prepare(
      `INSERT INTO invoices (invoice_no, job_id, token_number, customer_id, customer_name,
         date, subtotal, discount, net_amount, status)
       VALUES ('INV-000001', 1, 'PTS-901', 1, 'Ali', '2026-08-31', 3000, 0, 3000, 'issued')`
    ).run();

    const invoiceId = (db.prepare('SELECT id FROM invoices').get() as { id: number }).id;

    postReceipt(db, { amount: 1000, invoiceId });
    let inv = db.prepare('SELECT status FROM invoices WHERE id = ?').get(invoiceId) as {
      status: string;
    };
    expect(inv.status).toBe('partial');

    postReceipt(db, { amount: 2000, invoiceId, description: 'Balance settlement' });
    inv = db.prepare('SELECT status FROM invoices WHERE id = ?').get(invoiceId) as {
      status: string;
    };
    expect(inv.status).toBe('paid');

    // Paid amount = allocated credit lines
    const paid = db
      .prepare('SELECT COALESCE(SUM(credit), 0) AS c FROM voucher_lines WHERE invoice_id = ?')
      .get(invoiceId) as unknown as { c: number };
    expect(paid.c).toBe(3000);
  });
});

describe('voucher deletion re-derives job status from remaining credits', () => {
  it('deleting one of two partial payments keeps the job PAID when the rest covers it', () => {
    const db = makeDb();
    postReceipt(db, { amount: 1500 });
    postReceipt(db, { amount: 1500, description: 'Final payment' });
    let job = db.prepare("SELECT payment_status FROM jobs WHERE token_number = 'PTS-901'").get() as {
      payment_status: string;
    };
    expect(job.payment_status).toBe('paid');

    // Delete the SECOND voucher (the non-legacy one, mirror-matched)
    const voucher = db.prepare('SELECT id FROM vouchers ORDER BY id DESC LIMIT 1').get() as {
      id: number;
    };

    // Production deleteVoucher op sequence (see finance.ts deleteVoucher):
    // mirror delete (matches date+description+amount) BEFORE lines are gone.
    const mirrorDel = db.prepare(
      `DELETE FROM financial_transactions WHERE id IN (
         SELECT ft.id FROM financial_transactions ft
         WHERE ft.date = ? AND ft.description = ?
           AND ft.amount = (SELECT COALESCE(MAX(vl.debit), 0) FROM voucher_lines vl WHERE vl.voucher_id = ?)
       )`
    );
    mirrorDel.run('2026-08-31', 'Final payment', voucher.id);
    db.prepare('DELETE FROM voucher_lines WHERE voucher_id = ?').run(voucher.id);
    db.prepare('DELETE FROM vouchers WHERE id = ?').run(voucher.id);
    runOps(db, [deriveJobPaymentStatusOp('PTS-901')]);

    // 1500 of 3000 remains → job correctly back to DUE (partial), NOT force-reverted wrongly
    job = db.prepare("SELECT payment_status FROM jobs WHERE token_number = 'PTS-901'").get() as {
      payment_status: string;
    };
    expect(job.payment_status).toBe('due');
    const paid = db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS c FROM financial_transactions WHERE type = 'credit' AND token_number = 'PTS-901'")
      .get() as unknown as { c: number };
    expect(paid.c).toBe(1500);
  });

  it('deleting the only payment reverts the job to DUE and removes the mirror', () => {
    const db = makeDb();
    postReceipt(db, { amount: 3000 });
    expect(
      (db.prepare("SELECT payment_status FROM jobs WHERE token_number = 'PTS-901'").get() as { payment_status: string }).payment_status
    ).toBe('paid');

    const voucher = db.prepare('SELECT id FROM vouchers').get() as { id: number };
    db.prepare(
      `DELETE FROM financial_transactions WHERE id IN (
         SELECT ft.id FROM financial_transactions ft
         WHERE ft.date = ? AND ft.description = ?
           AND ft.amount = (SELECT COALESCE(MAX(vl.debit), 0) FROM voucher_lines vl WHERE vl.voucher_id = ?)
       )`
    ).run('2026-08-31', 'Repair charges for PTS-901', voucher.id);
    db.prepare('DELETE FROM voucher_lines WHERE voucher_id = ?').run(voucher.id);
    db.prepare('DELETE FROM vouchers WHERE id = ?').run(voucher.id);
    runOps(db, [deriveJobPaymentStatusOp('PTS-901')]);

    const job = db.prepare("SELECT payment_status FROM jobs WHERE token_number = 'PTS-901'").get() as {
      payment_status: string;
    };
    expect(job.payment_status).toBe('due');
    const remaining = db.prepare('SELECT COUNT(*) AS c FROM financial_transactions').get() as {
      c: number;
    };
    expect(remaining.c).toBe(0);
  });
});

describe('deriveJobPaymentStatusOp edge cases', () => {
  it('complimentary jobs are untouched (explicit waiver preserved)', () => {
    const db = makeDb();
    db.prepare("UPDATE jobs SET payment_status = 'complimentary' WHERE token_number = 'PTS-901'").run();
    runOps(db, [deriveJobPaymentStatusOp('PTS-901')]);
    const job = db.prepare("SELECT payment_status FROM jobs WHERE token_number = 'PTS-901'").get() as {
      payment_status: string;
    };
    expect(job.payment_status).toBe('complimentary');
  });

  it('deleted (soft) jobs are not touched by the derivation', () => {
    const db = makeDb();
    db.prepare("UPDATE jobs SET deleted_at = datetime('now') WHERE token_number = 'PTS-901'").run();
    runOps(db, [deriveJobPaymentStatusOp('PTS-901')]);
    const job = db.prepare("SELECT payment_status, deleted_at FROM jobs WHERE token_number = 'PTS-901'").get() as {
      payment_status: string;
      deleted_at: string;
    };
    expect(job.payment_status).toBe('due');
    expect(job.deleted_at).not.toBeNull();
  });
});
