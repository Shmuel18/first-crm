import { describe, expect, it } from 'vitest';

import { sumMonthlyPayments, sumRemainingDebt } from './totals';

describe('sumMonthlyPayments', () => {
  it('sums monthly_payment across rows', () => {
    expect(
      sumMonthlyPayments([
        { monthly_payment: 1_200 },
        { monthly_payment: 800 },
        { monthly_payment: 450 },
      ]),
    ).toBe(2_450);
  });

  it('treats null as zero — partial records still contribute', () => {
    expect(
      sumMonthlyPayments([
        { monthly_payment: 1_000 },
        { monthly_payment: null },
        { monthly_payment: 500 },
      ]),
    ).toBe(1_500);
  });

  it('returns 0 for empty list', () => {
    expect(sumMonthlyPayments([])).toBe(0);
  });

  it('returns 0 when every row is null', () => {
    expect(
      sumMonthlyPayments([{ monthly_payment: null }, { monthly_payment: null }]),
    ).toBe(0);
  });
});

describe('sumRemainingDebt', () => {
  it('sums loan_amount across rows', () => {
    expect(
      sumRemainingDebt([
        { loan_amount: 50_000 },
        { loan_amount: 25_000 },
        { loan_amount: 10_000 },
      ]),
    ).toBe(85_000);
  });

  it('treats null as zero', () => {
    expect(
      sumRemainingDebt([
        { loan_amount: 80_000 },
        { loan_amount: null },
      ]),
    ).toBe(80_000);
  });

  it('returns 0 for empty list', () => {
    expect(sumRemainingDebt([])).toBe(0);
  });

  it('handles a single non-null entry', () => {
    expect(sumRemainingDebt([{ loan_amount: 12_345 }])).toBe(12_345);
  });
});
