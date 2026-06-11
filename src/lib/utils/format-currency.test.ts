import { describe, expect, it } from 'vitest';

import { formatCurrency } from './format-currency';

describe('formatCurrency', () => {
  it('returns the em-dash sentinel for blank/whitespace strings', () => {
    expect(formatCurrency('', 'he')).toBe('—');
    expect(formatCurrency('   ', 'en')).toBe('—');
  });

  it('returns the sentinel for nullish and non-finite values', () => {
    expect(formatCurrency(null, 'he')).toBe('—');
    expect(formatCurrency(undefined, 'en')).toBe('—');
    expect(formatCurrency('abc', 'he')).toBe('—');
    expect(formatCurrency(Number.NaN, 'he')).toBe('—');
  });

  it('formats genuine zero and numbers (not the sentinel)', () => {
    expect(formatCurrency('0', 'he')).not.toBe('—');
    expect(formatCurrency(0, 'en')).not.toBe('—');
    expect(formatCurrency(1234, 'en')).toContain('1,234');
  });
});
