/**
 * PARTIAL payment presentation: a Rs 3,000 bill with Rs 1,500 received must
 * render as PARTIAL ("Rs 1,500 remaining") and only flip to PAID once the
 * remainder is settled. Overpaid jobs clamp to PAID (no negative remainder).
 */
import { describe, it, expect } from 'vitest';
import { getPaymentStatusMeta } from '../paymentStatus';

describe('getPaymentStatusMeta — partial payment presentation', () => {
  it('due + part paid + remainder → PARTIAL with remaining amount', () => {
    const meta = getPaymentStatusMeta('due', 3000, { paid: 1500, remaining: 1500 });
    expect(meta.badgeLabel).toBe('PARTIAL');
    expect(meta.description).toContain('1,500');
    expect(meta.subLine).toContain('1,500');
    expect(meta.completed).toBe(false);
  });

  it('due + nothing paid → plain DUE (no PARTIAL)', () => {
    const meta = getPaymentStatusMeta('due', 3000, { paid: 0, remaining: 3000 });
    expect(meta.badgeLabel).toBe('DUE');
  });

  it('due + fully paid (remaining 0) → still DUE label, no PARTIAL — data stays authoritative', () => {
    // remaining clamped to 0 means the status UPDATE should already have
    // flipped the job to 'paid'; the presentation never invents PAID.
    const meta = getPaymentStatusMeta('due', 3000, { paid: 3000, remaining: 0 });
    expect(meta.badgeLabel).toBe('DUE');
    expect(meta.completed).toBe(false);
  });

  it('paid + overpaid balance (negative clamped) → PAID', () => {
    const meta = getPaymentStatusMeta('paid', 3000, { paid: 3500, remaining: 0 });
    expect(meta.badgeLabel).toBe('PAID');
    expect(meta.completed).toBe(true);
  });

  it('complimentary ignores balance', () => {
    const meta = getPaymentStatusMeta('complimentary', 3000, { paid: 0, remaining: 3000 });
    expect(meta.badgeLabel).toBe('COMPLIMENTARY');
  });

  it('no balance supplied → legacy behavior unchanged', () => {
    expect(getPaymentStatusMeta('due', 3000).badgeLabel).toBe('DUE');
    expect(getPaymentStatusMeta('paid', 3000).badgeLabel).toBe('PAID');
    expect(getPaymentStatusMeta('complimentary', 3000).badgeLabel).toBe('COMPLIMENTARY');
  });
});
