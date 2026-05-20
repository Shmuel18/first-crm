import { describe, expect, it } from 'vitest';

import { calculateLtv, ltvBand } from './calculations';

describe('calculateLtv', () => {
  it('computes loan-to-value as a percentage', () => {
    expect(calculateLtv(1_000_000, 750_000)).toBe(75);
  });

  it('accepts numeric strings', () => {
    expect(calculateLtv('1000000', '600000')).toBe(60);
  });

  it('returns null when the property value is zero (avoids divide-by-zero)', () => {
    expect(calculateLtv(0, 500_000)).toBeNull();
  });

  it('returns null when an input is missing or empty', () => {
    expect(calculateLtv(null, 500_000)).toBeNull();
    expect(calculateLtv(1_000_000, undefined)).toBeNull();
    expect(calculateLtv(1_000_000, '')).toBeNull();
  });

  it('returns null for non-numeric input', () => {
    expect(calculateLtv('abc', 500_000)).toBeNull();
  });
});

describe('ltvBand', () => {
  it('classifies 60 and below as safe', () => {
    expect(ltvBand(0)).toBe('safe');
    expect(ltvBand(60)).toBe('safe');
  });

  it('classifies above 60 up to 75 as moderate', () => {
    expect(ltvBand(60.1)).toBe('moderate');
    expect(ltvBand(75)).toBe('moderate');
  });

  it('classifies above 75 as high', () => {
    expect(ltvBand(75.1)).toBe('high');
    expect(ltvBand(100)).toBe('high');
  });
});
