import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, formatDateTime, isOverdue } from '../utils';

describe('formatCurrency', () => {
  it('formats PKR amounts with Rs prefix', () => {
    expect(formatCurrency(2500)).toContain('Rs');
    expect(formatCurrency(2500)).toContain('2,500');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toContain('0');
  });
});

describe('formatDate', () => {
  it('formats ISO dates as DD/MM/YYYY', () => {
    expect(formatDate('2026-08-15')).toBe('15/08/2026');
  });

  it('returns N/A for empty input', () => {
    expect(formatDate(null)).toBe('N/A');
    expect(formatDate('')).toBe('N/A');
  });

  it('returns the raw string when unparseable', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatDateTime', () => {
  it('formats a date-time', () => {
    const out = formatDateTime('2026-08-15T10:30:00');
    expect(out).toContain('2026');
    expect(out).toContain('Aug');
  });

  it('returns N/A for empty input', () => {
    expect(formatDateTime(undefined)).toBe('N/A');
  });
});

describe('isOverdue', () => {
  it('is false when the job is delivered', () => {
    expect(isOverdue('2020-01-01', 'delivered')).toBe(false);
  });

  it('is false when no return date is set', () => {
    expect(isOverdue(null, 'pending')).toBe(false);
  });

  it('is true when the return date is in the past and not delivered', () => {
    expect(isOverdue('2020-01-01', 'pending')).toBe(true);
  });
});
