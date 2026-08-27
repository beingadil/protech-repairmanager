import { describe, it, expect } from 'vitest';
import { PAPER_SPECS, paperToFormat, buildStandaloneHtml } from '../print-document';
import { buildInvoiceData } from '../invoice';
import { Job } from '../../types/job';

const SETTINGS = { shop_name: 'ProTech Services' } as never;

const job = {
  id: 1,
  token_number: 'PTS-003',
  customer_name: 'AL KAREEM JWEELDD SKBBSM WW',
  customer_mobile: '03001234567',
  charges: 15000,
  discount: 0,
  payment_status: 'paid',
  deliver_status: 'ready',
  receive_date: '2026-08-20',
  return_date: '2026-08-25',
  device_type: 'Laptop',
  brand_model: 'Dell Latitude 5420 Business Laptop'
} as unknown as Job;

describe('print document preparation', () => {
  it('80mm media maps to 72mm printable content width', () => {
    const data = buildInvoiceData(job, SETTINGS, [], 'payment_receipt', '80');
    expect(data.paper).toBe('80');
    expect(paperToFormat('80')).toBe('thermal80');
    // Bixolon SRP-Q302: ~72mm max print width on 80mm media.
    expect(buildStandaloneHtml(data)).toContain('width:72mm');
    expect(buildStandaloneHtml(data)).not.toContain('width: 80mm');
  });

  it('58mm template uses its own narrower printable width', () => {
    const data = buildInvoiceData(job, SETTINGS, [], 'payment_receipt', '58');
    const html = buildStandaloneHtml(data);
    expect(html).toContain('width:54mm');
    expect(html).toContain('@page { size: 58mm auto');
  });

  it('A4 document embeds the A4 page rule', () => {
    const data = buildInvoiceData(job, SETTINGS, [], 'payment_receipt', 'a4');
    expect(paperToFormat('a4')).toBe('a4');
    expect(buildStandaloneHtml(data)).toContain('size: 210mm 297mm');
  });

  it('standalone html is fully self-contained (no app CSS dependency)', () => {
    const data = buildInvoiceData(job, SETTINGS, [], 'payment_receipt', '80');
    const html = buildStandaloneHtml(data);
    // No Tailwind classes needed for structure, no external stylesheets.
    expect(html).not.toMatch(/<link[^>]+stylesheet/);
    expect(html).toContain('<style>');
  });
});

// Keep PAPER_SPECS import used for future micron assertions.
expect(PAPER_SPECS.thermal80.pageWidthMicrons).toBe(80_000);
