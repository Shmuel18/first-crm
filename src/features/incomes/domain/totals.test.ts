import { describe, expect, it } from 'vitest';

import { sumMonthlyIncomes } from './totals';

describe('sumMonthlyIncomes', () => {
  it('sums positive monthly amounts', () => {
    expect(
      sumMonthlyIncomes([
        { amount_monthly: 10_000 },
        { amount_monthly: 7_500 },
        { amount_monthly: 3_000 },
      ]),
    ).toBe(20_500);
  });

  it('treats null amounts as zero (partial records still contribute)', () => {
    expect(
      sumMonthlyIncomes([
        { amount_monthly: 10_000 },
        { amount_monthly: null },
        { amount_monthly: 5_000 },
      ]),
    ).toBe(15_000);
  });

  it('returns 0 for an empty list', () => {
    expect(sumMonthlyIncomes([])).toBe(0);
  });

  it('returns 0 when every row has null', () => {
    expect(
      sumMonthlyIncomes([
        { amount_monthly: null },
        { amount_monthly: null },
      ]),
    ).toBe(0);
  });

  it('handles a single non-null entry', () => {
    expect(sumMonthlyIncomes([{ amount_monthly: 12_345 }])).toBe(12_345);
  });

  it('treats undefined like null (Pick<> tolerates absent fields at runtime)', () => {
    expect(
      sumMonthlyIncomes([
        // Force-undefined via cast — exercises the typeof check in the impl.
        { amount_monthly: undefined as unknown as number | null },
        { amount_monthly: 1_000 },
      ]),
    ).toBe(1_000);
  });
});
