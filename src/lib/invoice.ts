import { Job } from '../types/job';
import { FinancialTransaction } from '../types/payment';
import { AppSettings } from '../types/settings';

/**
 * Shared invoice / receipt data model.
 *
 * ONE data-preparation layer used by ALL presentation templates (A4 / 80mm / 58mm)
 * so no template duplicates business calculations. A template only receives the
 * already-prepared `InvoiceData` and decides how to render it.
 */

export type InvoiceDocType = 'payment_receipt' | 'repair_job' | 'waiver';
export type InvoicePaper = 'a4' | '80' | '58';

export interface PaymentSummary {
  /** Original repair charges on the job (gross) */
  charges: number;
  /** Discount waived (PKR), clamped to [0, charges] */
  discount: number;
  /** Gross minus discount */
  netAmount: number;
  /** Sum of credit transactions already posted against this job token */
  paid: number;
  /** max(0, netAmount - paid) */
  balance: number;
}

export interface InvoicePaymentMethod {
  label: string;
  date?: string;
}

export interface InvoiceData {
  docType: InvoiceDocType;
  paper: InvoicePaper;
  shop: {
    name: string;
    slogan: string;
    address: string;
    phone: string;
    whatsapp: string;
    logoPath: string;
    footerMsg: string;
    terms: string;
    showLogo: boolean;
    showQr: boolean;
  };
  customer: {
    name: string;
    mobile: string;
    address: string;
  };
  repair: {
    token: string;
    deviceType: string;
    model: string;
    serialNo: string;
    ram: string;
    hard: string;
    processor: string;
    symptoms: string;
    receiveDate: string;
    returnDate: string;
    hasCharger: boolean;
  };
  payment: PaymentSummary;
  paymentInfo: {
    latestMethod: string;
    latestDate: string;
    isComplimentary: boolean;
  };
  issuedAt: string;
}

export function clampNonNegative(n: number): number {
  if (!isFinite(n)) return 0;
  return n < 0 ? 0 : n;
}

/**
 * Single source of truth for the money math shown on receipts:
 *   netAmount = charges - discount
 *   balance   = max(0, netAmount - totalCreditReceived)
 */
export function computePaymentSummary(
  job: Pick<Job, 'charges' | 'discount'>,
  transactions: Pick<FinancialTransaction, 'type' | 'amount' | 'token_number'>[]
): PaymentSummary {
  const charges = clampNonNegative(Number(job.charges) || 0);
  let discount = clampNonNegative(Number(job.discount) || 0);
  if (discount > charges) discount = charges;

  const token = undefined; // unused; receipts aggregate ALL credits for the job
  void token;

  const paid = (transactions || [])
    .filter((t) => t.type === 'credit')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const netAmount = charges - discount;
  const balance = Math.max(0, netAmount - paid);
  return { charges, discount, netAmount, paid, balance };
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  jazzcash: 'JazzCash',
  easypaisa: 'EasyPaisa',
  other: 'Other'
};

export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return '—';
  return METHOD_LABELS[method] || method;
}

/**
 * Prepare all business data a print template needs. Templates must NOT reach
 * into the database or recompute money math — they consume this object only.
 */
export function buildInvoiceData(
  job: Job,
  settings: Partial<AppSettings>,
  transactions: FinancialTransaction[],
  docType: InvoiceDocType,
  paper: InvoicePaper
): InvoiceData {
  const txList: Array<Pick<FinancialTransaction, 'type' | 'amount' | 'token_number'>> =
    (transactions || []).map((t) => ({
      type: t.type,
      amount: t.amount,
      token_number: t.token_number || null
    }));
  const payment = computePaymentSummary(job, txList);

  // Latest credit transaction on this job token (when printed on a payment receipt)
  const tokenName = (job.token_number || '').trim();
  const credits = (transactions || []).filter(
    (t) => t.type === 'credit' && (t.token_number || '').trim() === tokenName
  );
  const latest = credits[credits.length - 1];

  return {
    docType,
    paper,
    shop: {
      name: settings.shop_name || 'ProTech Services',
      slogan: settings.shop_slogan || '',
      address: settings.shop_address || '',
      phone: settings.shop_mobile || '',
      whatsapp: settings.shop_whatsapp || '',
      logoPath: settings.logo_path || '',
      footerMsg: settings.receipt_footer_msg || '',
      terms: settings.receipt_terms || '',
      showLogo: settings.show_logo_on_receipt !== '0',
      showQr: settings.show_qr_on_receipt !== '0'
    },
    customer: {
      name: job.customer_name || 'Valued Customer',
      mobile: job.customer_mobile || '',
      address: job.customer_address || ''
    },
    repair: {
      token: job.token_number,
      deviceType: job.job_type === 'pc' ? 'PC' : 'Laptop',
      model: job.model || '—',
      serialNo: job.serial_no || '—',
      ram: job.ram || '—',
      hard: job.hard || '—',
      processor: job.processor || '—',
      symptoms: job.symptoms || '',
      receiveDate: job.receive_date || '',
      returnDate: job.return_date || '',
      hasCharger: Number(job.has_charger) === 1
    },
    payment,
    paymentInfo: {
      latestMethod: latest ? paymentMethodLabel(latest.payment_method) : '—',
      latestDate: latest ? String(latest.date || '') : '',
      isComplimentary: job.payment_status === 'complimentary'
    },
    issuedAt: new Date().toLocaleDateString('en-PK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  };
}