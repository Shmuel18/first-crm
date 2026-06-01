import { describe, expect, it } from 'vitest';

import { aggregateMix } from './mix-aggregate';
import { mortgageStateAtMonth } from './mix-state';

import type { MixInput } from '../types';

// 0% interest, single track: every payment is pure principal, so the snapshot
// math is exact and hand-checkable. 120,000 over 12 months → 10,000/month.
const mix: MixInput = {
  mortgageAmount: 120_000,
  propertyValue: 240_000,
  equity: 120_000,
  defaultTermMonths: 12,
  tracks: [
    {
      id: 'a',
      type: 'fixed_unlinked',
      amount: 120_000,
      annualRatePct: 0,
      termMonths: 12,
      repayment: 'spitzer',
      cpiAnnualPct: null,
      graceMonths: null,
    },
  ],
};

describe('mortgageStateAtMonth', () => {
  const result = aggregateMix(mix);

  it('splits cash paid into principal-reduced and interest at a 0% loan', () => {
    const state = mortgageStateAtMonth(result, mix.mortgageAmount, 3);
    expect(state.month).toBe(3);
    expect(state.paidToDate).toBe(30_000);
    expect(state.principalReduced).toBe(30_000); // 0% → all principal
    expect(state.interestAndIndexationPaid).toBe(0);
    expect(state.closingBalance).toBe(90_000);
    expect(state.remainingToPay).toBe(90_000);
    expect(state.monthlyPayment).toBe(10_000);
  });

  it('reconciles: principalReduced + interest always equals paidToDate', () => {
    const state = mortgageStateAtMonth(result, mix.mortgageAmount, 7);
    expect(state.principalReduced + state.interestAndIndexationPaid).toBe(state.paidToDate);
  });

  it('clamps an out-of-range month to the schedule length', () => {
    const state = mortgageStateAtMonth(result, mix.mortgageAmount, 999);
    expect(state.month).toBe(12);
    expect(state.closingBalance).toBe(0);
    expect(state.remainingToPay).toBe(0);
  });
});
