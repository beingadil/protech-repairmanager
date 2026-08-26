import { describe, it, expect } from 'vitest';
import { getPaymentStatusMeta } from '../paymentStatus';

describe('getPaymentStatusMeta', () => {
  it('complimentary → completed "Complimentary Payment" with no-payment-required text', () => {
    const meta = getPaymentStatusMeta('complimentary', 15000);
    expect(meta.statusLabel).toBe('Complimentary Payment');
    expect(meta.badgeLabel).toBe('COMPLIMENTARY');
    expect(meta.description).toBe('No payment required');
    expect(meta.completed).toBe(true);
  });

  it('paid → completed "Payment Received" with amount received', () => {
    const meta = getPaymentStatusMeta('paid', 15000);
    expect(meta.statusLabel).toBe('Payment Received');
    expect(meta.badgeLabel).toBe('PAID');
    expect(meta.description).toContain('15,000');
    expect(meta.description).toContain('received');
    expect(meta.completed).toBe(true);
  });

  it('paid with zero charges still completes', () => {
    const meta = getPaymentStatusMeta('paid', 0);
    expect(meta.completed).toBe(true);
    expect(meta.description).toBe('Payment received');
  });

  it('due → pending "Payment Pending" with payment-required text', () => {
    const meta = getPaymentStatusMeta('due', 15000);
    expect(meta.statusLabel).toBe('Payment Pending');
    expect(meta.badgeLabel).toBe('DUE');
    expect(meta.description).toBe('Payment required');
    expect(meta.completed).toBe(false);
  });
});