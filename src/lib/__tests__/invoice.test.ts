import { describe, it, expect } from 'vitest';
import { computePaymentSummary, buildInvoiceData, paymentMethodLabel } from '../invoice';
import { Job } from '../../types/job';
import { FinancialTransaction } from '../../types/payment';

const baseJob = {
  id: 1,
  token_number: 'PTS-001',
  customer_name: 'AL KAREEM JWEELDD SKBBSM WW',
  customer_mobile: '12314',
  charges: 15000,
  discount: 0,
  payment_status: 'due' as const,
  deliver_status: 'pending' as const,
  job_type: 'laptop' as const,
  model: 'adasdf',
  serial_no: 'SN-1',
  receive_date: '2026-08-01',
  return_date: '2026-08-05',
  has_charger: 1,
  symptoms: 'No power'
} as Job;

describe('computePaymentSummary', () => {
  it('netAmount = charges - discount, balance = net - paid', () => {
    const s = computePaymentSummary({ charges: 15000, discount: 2000 }, [
      { type: 'credit', amount: 13000, token_number: 'PTS-001' }
    ]);
    expect(s).toEqual({ charges: 15000, discount: 2000, netAmount: 13000, paid: 13000, balance: 0 });
  });

  it('never allows discount > charges or negative values', () => {
    const s = computePaymentSummary({ charges: 15000, discount: 99999 }, []);
    expect(s.discount).toBe(15000);
    expect(s.netAmount).toBe(0);
    expect(s.balance).toBe(0);
  });

  it('negative discount is treated as zero', () => {
    const s = computePaymentSummary({ charges: 15000, discount: -500 }, []);
    expect(s.discount).toBe(0);
    expect(s.netAmount).toBe(15000);
  });

  it('paid sums only credit transactions', () => {
    const s = computePaymentSummary({ charges: 15000, discount: 0 }, [
      { type: 'credit', amount: 10000, token_number: 'PTS-001' },
      { type: 'debit', amount: 5000, token_number: 'PTS-001' }
    ]);
    expect(s.paid).toBe(10000);
    expect(s.balance).toBe(5000);
  });

  it('complimentary job: discount clamps net to 0 without any fake payment', () => {
    const s = computePaymentSummary({ charges: 15000, discount: 15000 }, []);
    expect(s.netAmount).toBe(0);
    expect(s.paid).toBe(0);
    expect(s.balance).toBe(0);
  });
});

describe('buildInvoiceData', () => {
  it('payment receipt excludes repair-intake dates/symptoms from the model', () => {
    const data = buildInvoiceData(
      baseJob,
      { shop_name: 'ProTech' },
      [{
        type: 'credit', amount: 15000, token_number: 'PTS-001',
        date: '2026-08-25', payment_method: 'cash'
      } as unknown as FinancialTransaction],
      'payment_receipt',
      'a4'
    );
    expect(data.docType).toBe('payment_receipt');
    expect(data.paper).toBe('a4');
    expect(data.payment.paid).toBe(15000);
    expect(data.payment.balance).toBe(0);
    expect(data.paymentInfo.latestMethod).toBe('Cash');
    expect(data.paymentInfo.isComplimentary).toBe(false);
  });

  it('marks complimentary info for waiver documents', () => {
    const data = buildInvoiceData({ ...baseJob, payment_status: 'complimentary' }, {}, [], 'waiver', '58');
    expect(data.paymentInfo.isComplimentary).toBe(true);
    expect(data.paper).toBe('58');
  });
});

describe('paymentMethodLabel', () => {
  it('maps known methods and falls back gracefully', () => {
    expect(paymentMethodLabel('cash')).toBe('Cash');
    expect(paymentMethodLabel('bank_transfer')).toBe('Bank Transfer');
    expect(paymentMethodLabel('unknown_x')).toBe('unknown_x');
    expect(paymentMethodLabel(null)).toBe('—');
  });
});