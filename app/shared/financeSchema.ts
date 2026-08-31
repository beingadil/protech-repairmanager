/**
 * Finance v2 schema + one-time backfill — shared by the Electron main process
 * (app/main/database.ts) and the vitest SQL regression suite. Pure over a
 * better-sqlite3 Database so tests can run it against :memory: without
 * Electron.
 *
 * The schema is ADDITIVE ONLY: legacy tables (financial_transactions in
 * particular) are never modified, so a rollback to the previous app version
 * keeps working.
 */

import type Database from 'better-sqlite3';

export const FINANCE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('asset','liability','income','expense')),
    is_payment_account INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO accounts (code, name, type, is_payment_account) VALUES
    (1000, 'Cash in Hand',        'asset',     1),
    (1010, 'Bank Account',        'asset',     1),
    (1020, 'JazzCash',            'asset',     1),
    (1030, 'EasyPaisa',           'asset',     1),
    (2000, 'Accounts Payable',    'liability', 0),
    (2100, 'Customer Advances',   'liability', 0),
    (3000, 'Repair Income',       'income',    0),
    (3010, 'Parts Sales',         'income',    0),
    (3020, 'Other Income',        'income',    0),
    (4000, 'Parts Purchases',     'expense',   0),
    (4010, 'Supplier Payments',   'expense',   0),
    (4100, 'Rent & Utility Bills','expense',   0),
    (4200, 'Technician Salaries', 'expense',   0),
    (4300, 'Tools & Equipment',   'expense',   0),
    (4400, 'Miscellaneous Expense','expense',  0);

  CREATE TABLE IF NOT EXISTS vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no TEXT NOT NULL UNIQUE,
    date TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('receipt','payment','journal')),
    party_customer_id INTEGER REFERENCES customers(id),
    party_supplier_name TEXT,
    description TEXT NOT NULL,
    notes TEXT,
    legacy_tx_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers(date);
  CREATE INDEX IF NOT EXISTS idx_vouchers_type ON vouchers(type);
  CREATE INDEX IF NOT EXISTS idx_vouchers_party ON vouchers(party_customer_id);
  CREATE INDEX IF NOT EXISTS idx_vouchers_legacy ON vouchers(legacy_tx_id);

  CREATE TABLE IF NOT EXISTS voucher_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id INTEGER NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    debit REAL NOT NULL DEFAULT 0,
    credit REAL NOT NULL DEFAULT 0,
    reference_job_id INTEGER,
    reference_token TEXT,
    invoice_id INTEGER,
    notes TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_vlines_voucher ON voucher_lines(voucher_id);
  CREATE INDEX IF NOT EXISTS idx_vlines_account ON voucher_lines(account_id);
  CREATE INDEX IF NOT EXISTS idx_vlines_token ON voucher_lines(reference_token);
  CREATE INDEX IF NOT EXISTS idx_vlines_invoice ON voucher_lines(invoice_id);
  CREATE INDEX IF NOT EXISTS idx_vlines_job ON voucher_lines(reference_job_id);

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no TEXT NOT NULL UNIQUE,
    job_id INTEGER REFERENCES jobs(id),
    token_number TEXT,
    customer_id INTEGER REFERENCES customers(id),
    customer_name TEXT NOT NULL,
    date TEXT NOT NULL,
    due_date TEXT,
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    net_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft','issued','partial','paid','cancelled')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_invoices_no ON invoices(invoice_no);
  CREATE INDEX IF NOT EXISTS idx_invoices_job ON invoices(job_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
  CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);

  INSERT OR IGNORE INTO settings (key, value) VALUES ('voucher_counter', '0');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('invoice_counter', '0');
`;

const BACKFILL_FLAG = 'finance_v2_backfilled';

const CATEGORY_TO_CODE: Record<string, number> = {
  repair_income: 3000,
  advance_payment: 2100,
  parts_sale: 3010,
  other_income: 3020,
  parts_purchase: 4000,
  market_supplier_payment: 4010,
  shop_rent_bills: 4100,
  technician_salary: 4200,
  tools_equipment: 4300,
  miscellaneous_expense: 4400
};

const METHOD_TO_CODE: Record<string, number> = {
  cash: 1000,
  bank_transfer: 1010,
  jazzcash: 1020,
  easypaisa: 1030,
  other: 1000
};

/**
 * One-time transactional backfill: converts every legacy
 * financial_transactions row into a balanced voucher (legacy_tx_id keeps
 * provenance; the legacy table itself is never modified). Idempotent — rows
 * that already have a voucher are skipped, so a crashed partial run is safe
 * to retry. Throws on failure so the caller can leave the flag unset.
 *
 * NOTE: unlike the Electron path, the DB-file snapshot must be taken by the
 * caller BEFORE calling this (in tests it is irrelevant; in the app,
 * database.ts wraps this call with its snapshot step).
 */
export function backfillFinanceV2(db: Database.Database): void {
  const flag = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(BACKFILL_FLAG) as { value: string } | undefined;
  if (flag && flag.value === '1') return;

  const runBackfill = db.transaction(() => {
    // Advance the voucher counter past ALL backfilled numbering. Backfilled
    // numbers derive from legacy tx ids which can be non-contiguous
    // (restores, deletes) — so use MAX(id), never COUNT(*).
    const range = db
      .prepare('SELECT COUNT(*) AS c, COALESCE(MAX(id), 0) AS m FROM financial_transactions')
      .get() as { c: number; m: number };
    const currentCounter = Number(
      (
        db.prepare("SELECT value FROM settings WHERE key = 'voucher_counter'").get() as
          | { value: string }
          | undefined
      )?.value || '0'
    );
    const nextCounter = Math.max(range.c, range.m, currentCounter);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'voucher_counter',
      String(nextCounter)
    );

    const acct = new Map<number, number>(
      (db.prepare('SELECT id, code FROM accounts').all() as Array<{ id: number; code: number }>).map(
        (a) => [a.code, a.id]
      )
    );

    const insertVoucher = db.prepare(`
      INSERT INTO vouchers (voucher_no, date, type, party_customer_id, party_supplier_name,
                            description, notes, legacy_tx_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    const insertLine = db.prepare(`
      INSERT INTO voucher_lines (voucher_id, account_id, debit, credit,
                                 reference_job_id, reference_token, invoice_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)
    `);
    const hasVoucherFor = db.prepare('SELECT id FROM vouchers WHERE legacy_tx_id = ? LIMIT 1');
    const findCustomerId = db.prepare(
      'SELECT id FROM customers WHERE name = ? COLLATE NOCASE LIMIT 1'
    );
    const findJob = db.prepare(
      'SELECT id FROM jobs WHERE token_number = ? AND deleted_at IS NULL LIMIT 1'
    );

    const rows = db
      .prepare(
        `SELECT id, date, type, amount, category, payment_method,
                customer_id, customer_name, supplier_name, reference_job_id,
                token_number, description, notes
         FROM financial_transactions ORDER BY id ASC`
      )
      .all() as Array<{
      id: number;
      date: string;
      type: string;
      amount: number;
      category: string;
      payment_method: string;
      customer_id: number | null;
      customer_name: string | null;
      supplier_name: string | null;
      reference_job_id: number | null;
      token_number: string | null;
      description: string;
      notes: string | null;
    }>;

    for (const tx of rows) {
      if (hasVoucherFor.get(tx.id)) continue; // idempotent on partial runs

      const amount = Math.max(0, Number(tx.amount) || 0);
      if (amount <= 0) continue;

      const isCredit = tx.type === 'credit';
      const methodAcct = acct.get(METHOD_TO_CODE[tx.payment_method] ?? 1000);
      const categoryAcct = acct.get(
        CATEGORY_TO_CODE[tx.category] ?? (isCredit ? 3020 : 4400)
      );
      if (!methodAcct || !categoryAcct) continue;

      let partyCustomerId = tx.customer_id ?? null;
      if (!partyCustomerId && tx.customer_name) {
        const found = findCustomerId.get(tx.customer_name.trim()) as { id: number } | undefined;
        partyCustomerId = found?.id ?? null;
      }
      const supplierName =
        !partyCustomerId && tx.supplier_name ? tx.supplier_name.trim() : null;

      let jobId = tx.reference_job_id ?? null;
      const token = (tx.token_number || '').trim();
      if (!jobId && token) {
        const found = findJob.get(token) as { id: number } | undefined;
        jobId = found?.id ?? null;
      }

      const voucherNo = `VCH-${String(tx.id).padStart(6, '0')}`;
      const info = insertVoucher.run(
        voucherNo,
        tx.date,
        isCredit ? 'receipt' : 'payment',
        partyCustomerId,
        supplierName,
        tx.description || (isCredit ? 'Receipt' : 'Payment'),
        tx.notes,
        tx.id
      );
      const voucherId = Number(info.lastInsertRowid);

      if (isCredit) {
        // Receipt: Debit payment account (money in), credit category account.
        insertLine.run(voucherId, methodAcct, amount, 0, jobId, token || null);
        insertLine.run(voucherId, categoryAcct, 0, amount, jobId, token || null);
      } else {
        // Payment: Debit category (expense), credit payment account (money out).
        insertLine.run(voucherId, categoryAcct, amount, 0, jobId, token || null);
        insertLine.run(voucherId, methodAcct, 0, amount, jobId, token || null);
      }
    }

    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      BACKFILL_FLAG,
      '1'
    );
  });

  runBackfill();
}

export { BACKFILL_FLAG };
