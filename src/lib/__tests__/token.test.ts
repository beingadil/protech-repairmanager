import { describe, it, expect } from 'vitest';
import { formatTokenNumber } from '../token';

describe('formatTokenNumber', () => {
  it('pads counters to four digits', () => {
    expect(formatTokenNumber(1006)).toBe('TK-1006');
    expect(formatTokenNumber(6)).toBe('TK-0006');
  });

  it('keeps larger counters intact', () => {
    expect(formatTokenNumber(12345)).toBe('TK-12345');
  });

  it('clamps negative or NaN values to zero', () => {
    expect(formatTokenNumber(-5)).toBe('TK-0000');
    expect(formatTokenNumber(Number.NaN)).toBe('TK-0000');
  });
});
