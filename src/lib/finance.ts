/**
 * Finance v2 service layer — the SINGLE AUTHORITY for all money operations.
 *
 * Every writer in the app (payment forms, job intake, customer quick-pay,
 * invoice settlement) goes through this module. No page may INSERT into
 * vouchers / voucher_lines / financial_transactions directly.
 *
 * Design: pure op-builder functions return arrays of { sql, params } which
 * callers pass to `batch()` from lib/db.ts — one IPC round-trip, one SQLite
 * transaction, atomic. The builders are pure (no db access) so they are
 * unit-testable against an in-memory better-sqlite3 without Electron.
 */

import { query, execute, batch } from './db';
import { getNextDocumentNumber } from './db';
import {
  Account,
  Voucher,
  VoucherWithMeta,
  VoucherStats,
  Invoice,
  InvoiceWithMeta,
  VoucherType,
  ACCOUNT_CODE_TO_CATEGORY,
  ACCOUNT_CODE_TO_METHOD
} from '../types/finance';
import { Job } from '../types/job';

type DbOp = { sql: string; params?: unknown[] };

// ---------------------------------------------------------------------------
// Account helpers
// ---------------------------------------------------------------------------

export async function loadAccounts(): Promise<Account[]> {
  return query<Account>('SELECT * FROM accounts WHERE is_active = 1 ORDER BY code ASC');
}

export async function loadPaymentAccounts(): Promise<Account[]> {
  return query<Account>(
    'SELECT * FROM accounts WHERE is_active = 1 AND is_payment_account = 1 ORDER BY code ASC'
  );
}

export async function getAccountIdByCode(code: number): Promise<number | null> {
  const rows = await query<{ id: number }>('SELECT id FROM accounts WHERE code = ? LIMIT 1', [code]);
  return rows.length > 0 ? rows[0].id : null;
}

// ---------------------------------------------------------------------------
// Job payment status — the ONE derivation (SQL) used everywhere
// ---------------------------------------------------------------------------

/**
 * Balance-derived job payment status UPDATE op. A job is 'paid' only when
 * discount >= charges OR (sum of receipt credits + discount) >= charges.
 * An explicit 'complimentary' waiver is PRESERVED — the old derivation
 * silently destroyed waivers by flipping them to 'due'/'paid'.
 * Mirrors deriveJobPaymentStatus() in types/finance.ts — keep in sync.
 */
export function deriveJobPaymentStatusOp(token: string): DbOp {
  return {
    sql: `UPDATE jobs SET
            payment_status = CASE
              WHEN payment_status = 'complimentary' THEN 'complimentary'
              WHEN COALESCE(discount, 0) >= charges THEN 'paid'
              WHEN COALESCE((
                    SELECT SUM(amount) FROM financial_transactions
                    WHERE type = 'credit' AND token_number = jobs.token_number
                  ), 0) + COALESCE(discount, 0) >= charges THEN 'paid'
              ELSE 'due'
            END,
            updated_at = datetime('now')
          WHERE token_number = ? AND deleted_at IS NULL`,
    params: [token]
  };
}

/** Sum of receipt credits recorded against a job token (legacy + new writes). */
export async function getJobPaidAmount(token: string): Promise<number> {
  const rows = await query<{ c: number }>(
    "SELECT COALESCE(SUM(amount), 0) as c FROM financial_transactions WHERE type = 'credit' AND token_number = ?",
    [token]
  );
  return rows.length > 0 ? Number(rows[0].c) || 0 : 0;
}

// ---------------------------------------------------------------------------
// Voucher posting
// ---------------------------------------------------------------------------

export interface PostVoucherInput {
  date: string;
  type: VoucherType;
  amount: number;
  /** Category account code (3000 Repair Income, 4100 Rent...). */
  categoryAccountCode: number;
  /** Payment account code the money moves through (1000 Cash...). */
  paymentAccountCode: number;
  partyCustomerId?: number | null;
  partySupplierName?: string | null;
  referenceJobId?: number | null;
  referenceToken?: string | null;
  invoiceId?: number | null;
  description: string;
  notes?: string | null;
}

/**
 * Pure op-builder for a balanced money voucher. The exact SQL the app ships
 * runs in the vitest suite against in-memory better-sqlite3 — keep in sync
 * with the queries only through this function (never duplicate it).
 */
export function buildVoucherOps(
  input: PostVoucherInput,
  resolved: {
    voucherNo: string;
    payAcctId: number;
    catAcctId: number;
    partyName: string | null;
  }
): DbOp[] {
  const amount = Math.max(0, Number(input.amount) || 0);
  const token = (input.referenceToken || '').trim() || null;
  const isReceipt = input.type === 'receipt';
  const { voucherNo, payAcctId, catAcctId, partyName } = resolved;

  const ops: DbOp[] = [
    {
      sql: `INSERT INTO vouchers (voucher_no, date, type, party_customer_id, party_supplier_name,
              description, notes, legacy_tx_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'), datetime('now'))`,
      params: [
        voucherNo,
        input.date,
        input.type,
        input.partyCustomerId ?? null,
        input.partySupplierName ?? null,
        input.description.trim(),
        input.notes ?? null
      ]
    },
    {
      sql: `INSERT INTO voucher_lines (voucher_id, account_id, debit, credit,
              reference_job_id, reference_token, invoice_id, notes)
            VALUES ((SELECT id FROM vouchers WHERE voucher_no = ?), ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        voucherNo,
        isReceipt ? payAcctId : catAcctId,
        amount,
        0,
        input.referenceJobId ?? null,
        token,
        input.invoiceId ?? null,
        null
      ]
    },
    {
      sql: `INSERT INTO voucher_lines (voucher_id, account_id, debit, credit,
              reference_job_id, reference_token, invoice_id, notes)
            VALUES ((SELECT id FROM vouchers WHERE voucher_no = ?), ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        voucherNo,
        isReceipt ? catAcctId : payAcctId,
        0,
        amount,
        input.referenceJobId ?? null,
        token,
        input.invoiceId ?? null,
        null
      ]
    },
    // Legacy mirror so old list views + receipt math stay correct.
    {
      sql: `INSERT INTO financial_transactions (date, type, amount, category, payment_method,
              customer_id, customer_name, supplier_name, reference_job_id, token_number,
              description, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      params: [
        input.date,
        isReceipt ? 'credit' : 'debit',
        amount,
        ACCOUNT_CODE_TO_CATEGORY[input.categoryAccountCode] ||
          (isReceipt ? 'other_income' : 'miscellaneous_expense'),
        ACCOUNT_CODE_TO_METHOD[input.paymentAccountCode] || 'cash',
        input.partyCustomerId ?? null,
        isReceipt ? partyName : null,
        !isReceipt ? (input.partySupplierName ?? partyName) : null,
        input.referenceJobId ?? null,
        token,
        input.description.trim(),
        input.notes ?? null
      ]
    }
  ];

  if (token) ops.push(deriveJobPaymentStatusOp(token));

  if (input.invoiceId) {
    // Re-derive the invoice status from actual allocated receipts.
    ops.push({
      sql: `UPDATE invoices SET
              status = CASE
                WHEN status = 'cancelled' THEN 'cancelled'
                WHEN COALESCE((SELECT SUM(vl.credit) FROM voucher_lines vl WHERE vl.invoice_id = invoices.id), 0) >= net_amount THEN 'paid'
                WHEN COALESCE((SELECT SUM(vl.credit) FROM voucher_lines vl WHERE vl.invoice_id = invoices.id), 0) > 0 THEN 'partial'
                ELSE status
              END,
              updated_at = datetime('now')
            WHERE id = ?`,
      params: [input.invoiceId]
    });
  }

  return ops;
}

/**
 * Post a balanced money-in (receipt) or money-out (payment) voucher.
 * Also mirrors a legacy financial_transactions row + updates any linked
 * job's payment status, all in ONE atomic IPC batch.
 */
export async function postVoucher(input: PostVoucherInput): Promise<string> {
  const amount = Math.max(0, Number(input.amount) || 0);
  if (amount <= 0) throw new Error('Amount must be greater than zero.');
  if (!input.description?.trim()) throw new Error('Description is required.');
  if (input.type === 'journal') throw new Error('Use postJournal for journal vouchers.');

  const voucherNo = await getNextDocumentNumber('voucher_counter', 'VCH');
  const isReceipt = input.type === 'receipt';

  // Resolve account ids up front (single round-trip, cached by SQLite).
  const [payAcctRows, catAcctRows] = await batch([
    { sql: 'SELECT id FROM accounts WHERE code = ? LIMIT 1', params: [input.paymentAccountCode] },
    { sql: 'SELECT id FROM accounts WHERE code = ? LIMIT 1', params: [input.categoryAccountCode] }
  ]);
  const payAcctId = (payAcctRows as Array<{ id: number }>)[0]?.id;
  const catAcctId = (catAcctRows as Array<{ id: number }>)[0]?.id;
  if (!payAcctId || !catAcctId) throw new Error('Unknown account code.');

  // Party name for the legacy mirror row.
  let partyName: string | null = null;
  if (input.partyCustomerId) {
    const rows = await query<{ name: string }>('SELECT name FROM customers WHERE id = ? LIMIT 1', [
      input.partyCustomerId
    ]);
    partyName = rows[0]?.name ?? null;
  }

  const ops = buildVoucherOps(input, { voucherNo, payAcctId, catAcctId, partyName });

  await batch(ops);
  return voucherNo;
}

// ---------------------------------------------------------------------------
// Voucher queries + deletion
// ---------------------------------------------------------------------------

export async function loadVouchers(opts: {
  limit: number;
  offset: number;
  type?: VoucherType | 'all';
  search?: string;
}): Promise<{ rows: VoucherWithMeta[]; total: number }> {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (opts.type && opts.type !== 'all') {
    conds.push('v.type = ?');
    params.push(opts.type);
  }
  if (opts.search?.trim()) {
    conds.push('(v.description LIKE ? OR v.voucher_no LIKE ? OR v.party_supplier_name LIKE ? OR c.name LIKE ?)');
    const like = `%${opts.search.trim()}%`;
    params.push(like, like, like, like);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const rows = await query<VoucherWithMeta>(
    `SELECT v.id, v.voucher_no, v.date, v.type, v.party_customer_id, v.party_supplier_name,
            v.description, v.notes, v.legacy_tx_id, v.created_at, v.updated_at,
            COALESCE(c.name, v.party_supplier_name) AS party_name,
            (SELECT COALESCE(SUM(vl.debit), 0) FROM voucher_lines vl WHERE vl.voucher_id = v.id) AS total_amount,
            (SELECT COUNT(*) FROM voucher_lines vl WHERE vl.voucher_id = v.id) AS line_count,
            (SELECT vl.reference_token FROM voucher_lines vl WHERE vl.voucher_id = v.id AND vl.reference_token IS NOT NULL LIMIT 1) AS reference_token,
            (SELECT vl.reference_job_id FROM voucher_lines vl WHERE vl.voucher_id = v.id AND vl.reference_job_id IS NOT NULL LIMIT 1) AS reference_job_id
     FROM vouchers v
     LEFT JOIN customers c ON v.party_customer_id = c.id
     ${where}
     ORDER BY v.date DESC, v.id DESC
     LIMIT ? OFFSET ?`,
    [...params, opts.limit, opts.offset]
  );
  const totalRows = await query<{ c: number }>(
    `SELECT COUNT(*) as c FROM vouchers v LEFT JOIN customers c ON v.party_customer_id = c.id ${where}`,
    params
  );
  return { rows, total: totalRows[0]?.c ?? 0 };
}

export async function loadVoucherStats(): Promise<VoucherStats> {
  const rows = await query<{
    total_receipts: number;
    total_payments: number;
    today_receipts: number;
    today_payments: number;
    total_vouchers: number;
  }>(`SELECT
        SUM(CASE WHEN type = 'receipt' THEN (SELECT COALESCE(SUM(vl.debit), 0) FROM voucher_lines vl WHERE vl.voucher_id = vouchers.id) ELSE 0 END) AS total_receipts,
        SUM(CASE WHEN type = 'payment' THEN (SELECT COALESCE(SUM(vl.debit), 0) FROM voucher_lines vl WHERE vl.voucher_id = vouchers.id) ELSE 0 END) AS total_payments,
        SUM(CASE WHEN type = 'receipt' AND date = date('now') THEN (SELECT COALESCE(SUM(vl.debit), 0) FROM voucher_lines vl WHERE vl.voucher_id = vouchers.id) ELSE 0 END) AS today_receipts,
        SUM(CASE WHEN type = 'payment' AND date = date('now') THEN (SELECT COALESCE(SUM(vl.debit), 0) FROM voucher_lines vl WHERE vl.voucher_id = vouchers.id) ELSE 0 END) AS today_payments,
        COUNT(*) AS total_vouchers
      FROM vouchers`);
  const s = rows[0] || ({} as Record<string, number>);
  const totalReceipts = Number(s.total_receipts) || 0;
  const totalPayments = Number(s.total_payments) || 0;
  return {
    total_receipts: totalReceipts,
    total_payments: totalPayments,
    net_balance: totalReceipts - totalPayments,
    today_receipts: Number(s.today_receipts) || 0,
    today_payments: Number(s.today_payments) || 0,
    total_vouchers: Number(s.total_vouchers) || 0
  };
}

/**
 * Delete a voucher and re-derive the linked job status from REMAINING credits
 * (fixes the old force-revert-to-due bug). Runs in ONE atomic batch: the
 * legacy mirror row is identified BEFORE the voucher_lines are deleted.
 */
export async function deleteVoucher(voucherId: number): Promise<void> {
  const voucherRows = await query<{
    id: number;
    type: VoucherType;
    date: string;
    description: string;
    legacy_tx_id: number | null;
  }>('SELECT id, type, date, description, legacy_tx_id FROM vouchers WHERE id = ? LIMIT 1', [
    voucherId
  ]);
  const voucher = voucherRows[0];
  if (!voucher) throw new Error('Voucher not found.');

  const tokenRows = await query<{ reference_token: string | null }>(
    'SELECT reference_token FROM voucher_lines WHERE voucher_id = ? AND reference_token IS NOT NULL LIMIT 1',
    [voucherId]
  );
  const token = tokenRows[0]?.reference_token || null;

  const ops: DbOp[] = [];

  if (voucher.legacy_tx_id) {
    // Backfilled voucher — its mirror row carries the same id.
    ops.push({ sql: 'DELETE FROM financial_transactions WHERE id = ?', params: [voucher.legacy_tx_id] });
  } else {
    // New voucher — mirror row matches on date + description + max line amount.
    // Capture the amount BEFORE deleting the lines (subquery reads live rows).
    ops.push({
      sql: `DELETE FROM financial_transactions WHERE id IN (
              SELECT ft.id FROM financial_transactions ft
              WHERE ft.date = ?
                AND ft.description = ?
                AND ft.amount = (SELECT COALESCE(MAX(vl.debit), 0) FROM voucher_lines vl WHERE vl.voucher_id = ?)
            )`,
      params: [voucher.date, voucher.description, voucherId]
    });
  }

  ops.push({ sql: 'DELETE FROM voucher_lines WHERE voucher_id = ?', params: [voucherId] });
  ops.push({ sql: 'DELETE FROM vouchers WHERE id = ?', params: [voucherId] });

  // Re-derive job status from whatever credits REMAIN (no force-revert).
  if (token) ops.push(deriveJobPaymentStatusOp(token));

  await batch(ops);
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

/** Create an invoice from a job's charges/discount. Returns invoice_no. */
export async function createInvoiceFromJob(job: Job): Promise<string> {
  const charges = Math.max(0, Number(job.charges) || 0);
  const discount = Math.min(charges, Math.max(0, Number(job.discount) || 0));
  const net = charges - discount;
  const invoiceNo = await getNextDocumentNumber('invoice_counter', 'INV');

  let customerName = job.customer_name || 'Valued Customer';
  if (!job.customer_name && job.customer_id) {
    const rows = await query<{ name: string }>('SELECT name FROM customers WHERE id = ?', [job.customer_id]);
    customerName = rows[0]?.name ?? customerName;
  }

  await batch([
    {
      sql: `INSERT INTO invoices (invoice_no, job_id, token_number, customer_id, customer_name,
              date, due_date, subtotal, discount, net_amount, status, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, date('now'), NULL, ?, ?, ?, 'issued', NULL, datetime('now'), datetime('now'))`,
      params: [invoiceNo, job.id, job.token_number, job.customer_id, customerName, charges, discount, net]
    },
    deriveJobPaymentStatusOp(job.token_number)
  ]);
  return invoiceNo;
}

export async function loadInvoices(opts: {
  limit: number;
  offset: number;
  status?: string;
  search?: string;
}): Promise<{ rows: InvoiceWithMeta[]; total: number }> {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (opts.status && opts.status !== 'all') {
    conds.push('i.status = ?');
    params.push(opts.status);
  }
  if (opts.search?.trim()) {
    conds.push('(i.invoice_no LIKE ? OR i.customer_name LIKE ? OR i.token_number LIKE ?)');
    const like = `%${opts.search.trim()}%`;
    params.push(like, like, like);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const rows = await query<InvoiceWithMeta>(
    `SELECT i.*, c.mobile AS customer_mobile, j.model AS job_model, j.job_type AS job_type,
            j.deliver_status AS job_deliver_status,
            COALESCE((SELECT SUM(vl.credit) FROM voucher_lines vl WHERE vl.invoice_id = i.id), 0) AS paid_amount
     FROM invoices i
     LEFT JOIN customers c ON i.customer_id = c.id
     LEFT JOIN jobs j ON i.job_id = j.id
     ${where}
     ORDER BY i.date DESC, i.id DESC
     LIMIT ? OFFSET ?`,
    [...params, opts.limit, opts.offset]
  );
  const totalRows = await query<{ c: number }>(`SELECT COUNT(*) as c FROM invoices i ${where}`, params);
  return { rows, total: totalRows[0]?.c ?? 0 };
}

export async function getInvoice(id: number): Promise<InvoiceWithMeta | null> {
  const rows = await query<InvoiceWithMeta>(
    `SELECT i.*, c.mobile AS customer_mobile, j.model AS job_model, j.job_type AS job_type,
            j.deliver_status AS job_deliver_status,
            COALESCE((SELECT SUM(vl.credit) FROM voucher_lines vl WHERE vl.invoice_id = i.id), 0) AS paid_amount
     FROM invoices i
     LEFT JOIN customers c ON i.customer_id = c.id
     LEFT JOIN jobs j ON i.job_id = j.id
     WHERE i.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

/** Record a receipt voucher against an invoice (settles it via postVoucher). */
export async function recordInvoicePayment(
  invoiceId: number,
  input: {
    date: string;
    amount: number;
    paymentAccountCode: number;
    notes?: string | null;
  }
): Promise<string> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) throw new Error('Invoice not found.');
  if (invoice.status === 'cancelled') throw new Error('Cancelled invoices cannot accept payments.');
  if (invoice.status === 'paid') throw new Error('Invoice is already fully paid.');

  const paid = Number(invoice.paid_amount) || 0;
  const balance = Math.max(0, invoice.net_amount - paid);
  const amount = Math.max(0, Number(input.amount) || 0);
  if (amount <= 0) throw new Error('Amount must be greater than zero.');
  if (amount > balance) {
    throw new Error(`Payment exceeds invoice balance (${balance.toFixed(0)}).`);
  }

  return postVoucher({
    date: input.date,
    type: 'receipt',
    amount,
    categoryAccountCode: 3000,
    paymentAccountCode: input.paymentAccountCode,
    partyCustomerId: invoice.customer_id,
    referenceJobId: invoice.job_id,
    referenceToken: invoice.token_number,
    invoiceId: invoice.id,
    description: `Payment for invoice ${invoice.invoice_no}`,
    notes: input.notes ?? null
  });
}

export async function cancelInvoice(invoiceId: number): Promise<void> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) throw new Error('Invoice not found.');
  if (Number(invoice.paid_amount) > 0) {
    throw new Error('Invoices with recorded payments cannot be cancelled.');
  }
  await execute("UPDATE invoices SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?", [
    invoiceId
  ]);
}

// ---------------------------------------------------------------------------
// Party ledger (ID-based, replaces the name-string joins)
// ---------------------------------------------------------------------------

export interface PartyLedgerRow {
  voucher_id: number;
  voucher_no: string;
  date: string;
  type: VoucherType;
  description: string;
  amount: number;
  reference_token: string | null;
}

export async function loadPartyLedger(customerId: number): Promise<PartyLedgerRow[]> {
  return query<PartyLedgerRow>(
    `SELECT v.id AS voucher_id, v.voucher_no, v.date, v.type, v.description,
            COALESCE((SELECT MAX(vl.debit) FROM voucher_lines vl WHERE vl.voucher_id = v.id), 0) AS amount,
            (SELECT vl.reference_token FROM voucher_lines vl WHERE vl.voucher_id = v.id AND vl.reference_token IS NOT NULL LIMIT 1) AS reference_token
     FROM vouchers v
     WHERE v.party_customer_id = ?
     ORDER BY v.date ASC, v.id ASC`,
    [customerId]
  );
}

export interface PartySummaryRow {
  id: number;
  name: string;
  party_type: string;
  mobile: string;
  receipts: number;
  payments: number;
  net: number;
  entry_count: number;
}

export async function loadPartySummaries(): Promise<PartySummaryRow[]> {
  return query<PartySummaryRow>(
    `SELECT c.id, c.name, c.party_type, COALESCE(c.mobile, '') AS mobile,
            COALESCE((SELECT SUM(vl.debit) FROM voucher_lines vl
                      JOIN vouchers v ON v.id = vl.voucher_id
                      WHERE v.party_customer_id = c.id AND v.type = 'receipt'), 0) AS receipts,
            COALESCE((SELECT SUM(vl.debit) FROM voucher_lines vl
                      JOIN vouchers v ON v.id = vl.voucher_id
                      WHERE v.party_customer_id = c.id AND v.type = 'payment'), 0) AS payments,
            COALESCE((SELECT COUNT(*) FROM vouchers v WHERE v.party_customer_id = c.id), 0) AS entry_count
     FROM customers c
     ORDER BY c.name ASC`
  );
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface AccountFlowRow {
  code: number;
  name: string;
  type: string;
  total_debit: number;
  total_credit: number;
}

export async function loadAccountFlows(dateFrom?: string, dateTo?: string): Promise<AccountFlowRow[]> {
  const conds: string[] = [];
  const params: unknown[] = [];
  if (dateFrom) {
    conds.push('v.date >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conds.push('v.date <= ?');
    params.push(dateTo);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return query<AccountFlowRow>(
    `SELECT a.code, a.name, a.type,
            COALESCE(SUM(vl.debit), 0) AS total_debit,
            COALESCE(SUM(vl.credit), 0) AS total_credit
     FROM accounts a
     LEFT JOIN voucher_lines vl ON vl.account_id = a.id
     LEFT JOIN vouchers v ON v.id = vl.voucher_id
     ${where}
     GROUP BY a.id
     HAVING total_debit > 0 OR total_credit > 0
     ORDER BY a.code ASC`,
    params
  );
}

// Re-export for callers that still need the raw types.
export type { Voucher, VoucherWithMeta, Invoice, InvoiceWithMeta, VoucherStats };
