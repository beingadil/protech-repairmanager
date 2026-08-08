import { describe, it, expect } from 'vitest';
import { sanitizePhoneNumber, generateWhatsAppMessage } from '../whatsapp';
import type { Job } from '../../types/job';

const job: Job = {
  id: 1,
  token_number: 'TK-1006',
  customer_name: 'Ahmed Raza',
  customer_mobile: '0300-1234567',
  job_type: 'laptop',
  model: 'Dell XPS 15',
  charges: 2500,
  payment_status: 'due',
  return_date: '2026-08-15',
  symptoms: 'Won\u2019t power on'
} as Job;

describe('sanitizePhoneNumber', () => {
  it('converts Pakistan 03xx format to international 92xx', () => {
    expect(sanitizePhoneNumber('0300-1234567')).toBe('923001234567');
  });

  it('strips spaces, dashes and brackets', () => {
    expect(sanitizePhoneNumber('+92 (300) 123-4567')).toBe('923001234567');
  });

  it('leaves already-international numbers alone', () => {
    expect(sanitizePhoneNumber('971501234567')).toBe('971501234567');
  });
});

describe('generateWhatsAppMessage', () => {
  it('includes token, customer name and charges in the ready message', () => {
    const msg = generateWhatsAppMessage('ready', job, 'ProTech Services', '0300-0404004');
    expect(msg).toContain('TK-1006');
    expect(msg).toContain('Ahmed Raza');
    expect(msg).toContain('ProTech Services');
    expect(msg).toContain('Rs');
    expect(msg).toContain('2,500');
    expect(msg).toContain('ready for collection');
  });

  it('marks payment status as Paid when paid', () => {
    const paid = generateWhatsAppMessage('payment_reminder', { ...job, payment_status: 'paid' }, 'ProTech', '0300-0000000');
    expect(paid).toContain('TK-1006');
  });

  it('generates a payment reminder with outstanding amount', () => {
    const msg = generateWhatsAppMessage('payment_reminder', job, 'ProTech Services', '0300-0404004');
    expect(msg).toContain('Outstanding Amount');
    expect(msg).toContain('Rs');
    expect(msg).toContain('2,500');
  });
});
