import { describe, expect, it } from 'vitest';

import { blendedEffectiveRatePct, costPerShekel, peakMonth } from './mix-metrics';

import type { CurvePoint, TrackInput } from '../types';

const track = (over: Partial<TrackInput>): TrackInput => ({
  id: 't',
  type: 'fixed_unlinked',
  amount: 100_000,
  annualRatePct: 5,
  termMonths: 120,
  repayment: 'spitzer',
  cpiAnnualPct: null,
  graceMonths: null,
  ...over,
});

describe('costPerShekel', () => {
  it('is total cost divided by principal', () => {
    expect(costPerShekel(190_000, 100_000)).toBeCloseTo(1.9);
  });

  it('is 0 when principal is 0 (no divide-by-zero)', () => {
    expect(costPerShekel(500, 0)).toBe(0);
  });
});

describe('blendedEffectiveRatePct', () => {
  it('compounds a nominal rate to its effective annual rate (matches BoI)', () => {
    // single 4.86% fixed track → (1 + 4.86/1200)^12 − 1 ≈ 4.97%
    expect(blendedEffectiveRatePct([track({ annualRatePct: 4.86 })])).toBeCloseTo(4.97, 1);
  });

  it('uses the entered prime rate directly — no auto margin', () => {
    // prime 5.25 → effective ≈ 5.38%, NOT 6.75%
    expect(blendedEffectiveRatePct([track({ type: 'prime', annualRatePct: 5.25 })])).toBeLessThan(5.5);
  });

  it('weights each track by its amount', () => {
    const rate = blendedEffectiveRatePct([
      track({ amount: 300_000, annualRatePct: 4 }),
      track({ amount: 100_000, annualRatePct: 8 }),
    ]);
    // weighted nominal 5% → effective just above 5%
    expect(rate).toBeGreaterThan(5);
    expect(rate).toBeLessThan(5.3);
  });

  it('is 0 for an empty mix', () => {
    expect(blendedEffectiveRatePct([])).toBe(0);
  });
});

describe('peakMonth', () => {
  const curve = (values: ReadonlyArray<number>): CurvePoint[] =>
    values.map((value, index) => ({ monthIndex: index + 1, value }));

  it('returns the 1-based month of the highest value', () => {
    expect(peakMonth(curve([100, 300, 200]))).toBe(2);
  });

  it('returns the first month on ties', () => {
    expect(peakMonth(curve([300, 300, 100]))).toBe(1);
  });

  it('returns 0 for an empty curve', () => {
    expect(peakMonth([])).toBe(0);
  });
});
