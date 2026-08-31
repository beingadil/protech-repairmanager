/**
 * Finance v2 core types — chart of accounts, vouchers, invoice entities.
 *
 * The old model (a single `financial_transactions` cashbook row per event,
 * linked by name/token strings) is replaced by balanced vouchers:
 *   - every money event = one `vouchers` row + 2+ balanced `voucher_lines`
 *   - every line references an `accounts` chart entry
 *   - jobs link by id/token; parties link by customer_id (fallback: name)
 */

export type AccountType = 'asset' | 'liability' | 'income' | 'expense';

/** Chart-of-accounts entry. Payment accounts (cash/bank/wallets) are assets. */
export interface Account {
  id: number;
  code: number;
  name: string;
  type: AccountType;
  /** True for money-holding accounts (Cash, Bank, JazzCash, EasyPaisa) — pickable as payment method. */
  is_payment_account: 0 | 1;
  is_active: 0 | 1;
  created_at: string;
  updated_at: string;
}

export type VoucherType = 'receipt' | 'payment' | 'journal';

/** One financial event. receipt = money in, payment = money out, journal = corrections. */
export interface Voucher {
  id: number;
  voucher_no: string;
  date: string;
  type: VoucherType;
  /** Resolved party (customer or supplier-as-customer row). */
  party_customer_id: number | null;
  /** Free-text party label for suppliers without a customers row. */
  party_supplier_name: string | null;
  description: string;
  notes: string | null;
  /** Legacy financial_transactions.id this voucher was backfilled from (read-only provenance). */
  legacy_tx_id: number | null;
  created_at: string;
  updated_at: string;
}

/** A single balanced line of a voucher. Sum(debit) must equal Sum(credit) per voucher. */
export interface VoucherLine {
  id: number;
  voucher_id: number;
  account_id: number;
  debit: number;
  credit: number;
  reference_job_id: number | null;
  reference_token: string | null;
  invoice_id: number | null;
  notes: string | null;
}

export type InvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'cancelled';

/** First-class invoice entity (INV-xxxxxx) — can be reprinted, tracked, and settled. */
export interface Invoice {
  id: number;
  invoice_no: string;
  job_id: number | null;
  token_number: string | null;
  customer_id: number | null;
  customer_name: string;
  date: string;
  due_date: string | null;
  subtotal: number;
  discount: number;
  net_amount: number;
  status: InvoiceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Display-ready invoice row joined with customer + job info. */
export interface InvoiceWithMeta extends Invoice {
  customer_mobile?: string | null;
  job_model?: string | null;
  job_type?: string | null;
  job_deliver_status?: string | null;
  /** Sum of receipt-voucher credits allocated to this invoice. */
  paid_amount?: number;
}

export interface VoucherWithMeta extends Voucher {
  party_name?: string | null;
  total_amount?: number;
  line_count?: number;
  reference_token?: string | null;
  reference_job_id?: number | null;
}

export interface VoucherStats {
  total_receipts: number;
  total_payments: number;
  net_balance: number;
  today_receipts: number;
  today_payments: number;
  total_vouchers: number;
}

/** Party ledger running-balance row (used by the Party Ledger tab). */
export interface PartyLedgerEntry {
  voucher_id: number;
  voucher_no: string;
  date: string;
  type: VoucherType;
  description: string;
  debit: number;
  credit: number;
  account_name?: string;
  reference_token?: string | null;
}

/** Derivation input for the authoritative job payment status. */
export interface JobPaymentDerivation {
  charges: number;
  discount: number;
  paid: number;
}

export type DerivedPaymentStatus = 'paid' | 'due';

/**
 * The single authoritative job payment status rule (must match the SQL CASE
 * derivation used in voucher posting):
 *   complimentary — explicit waiver, kept as-is on the job row
 *   paid          — discount >= charges, OR credits + discount >= charges
 *   due           — otherwise
 */
export function deriveJobPaymentStatus(d: JobPaymentDerivation): DerivedPaymentStatus {
  const charges = Math.max(0, Number(d.charges) || 0);
  const discount = Math.max(0, Number(d.discount) || 0);
  const paid = Math.max(0, Number(d.paid) || 0);
  if (discount >= charges) return 'paid';
  if (paid + discount >= charges) return 'paid';
  return 'due';
}

/** True when part of the bill is paid but a remainder is left (UI-only PARTIAL presentation). */
export function isPartialPayment(d: JobPaymentDerivation): boolean {
  const charges = Math.max(0, Number(d.charges) || 0);
  const discount = Math.max(0, Number(d.discount) || 0);
  const paid = Math.max(0, Number(d.paid) || 0);
  const net = charges - discount;
  return paid > 0 && paid < net;
}

/** Map old cashbook category to the new chart-of-accounts code. */
export const CATEGORY_TO_ACCOUNT_CODE: Record<string, number> = {
  // income
  repair_income: 3000,
  advance_payment: 2100,
  parts_sale: 3010,
  other_income: 3020,
  // expense
  parts_purchase: 4000,
  market_supplier_payment: 4010,
  shop_rent_bills: 4100,
  technician_salary: 4200,
  tools_equipment: 4300,
  miscellaneous_expense: 4400
};

/** Map old payment method to the payment-account code it lands in. */
export const METHOD_TO_ACCOUNT_CODE: Record<string, number> = {
  cash: 1000,
  bank_transfer: 1010,
  jazzcash: 1020,
  easypaisa: 1030,
  other: 1000
};

/** Reverse maps for rendering legacy rows in the new UI. */
export const ACCOUNT_CODE_TO_CATEGORY: Record<number, string> = Object.fromEntries(
  Object.entries(CATEGORY_TO_ACCOUNT_CODE).map(([cat, code]) => [code, cat])
);

export const ACCOUNT_CODE_TO_METHOD: Record<number, string> = {
  1000: 'cash',
  1010: 'bank_transfer',
  1020: 'jazzcash',
  1030: 'easypaisa'
};
