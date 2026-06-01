import { describe, expect, it } from 'vitest';

import { costPerShekel, peakMonth, weightedAnnualRatePct } from './mix-metrics';

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

describe('weightedAnnualRatePct', () => {
  it('weights each track rate by its amount', () => {
    const rate = weightedAnnualRatePct([
      track({ amount: 300_000, annualRatePct: 4 }),
      track({ amount: 100_000, annualRatePct: 8 }),
    ]);
    expect(rate).toBeCloseTo(5); // (300k*4 + 100k*8) / 400k
  });

  it('uses the effective rate — prime adds its 1.5% margin', () => {
    const rate = weightedAnnualRatePct([track({ type: 'prime', amount: 100_000, annualRatePct: 4.5 })]);
    expect(rate).toBeCloseTo(6);
  });

  it('is 0 for an empty mix', () => {
    expect(weightedAnnualRatePct([])).toBe(0);
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
