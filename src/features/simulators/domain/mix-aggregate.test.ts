import { describe, expect, it } from 'vitest';

import { aggregateMix } from './mix-aggregate';

import type { MixInput } from '../types';

const mix: MixInput = {
  mortgageAmount: 1_000_000,
  propertyValue: 2_000_000,
  equity: 1_000_000,
  defaultTermMonths: 12,
  tracks: [
    {
      id: 'a',
      type: 'fixed_unlinked',
      amount: 600_000,
      annualRatePct: 0,
      termMonths: 12,
      repayment: 'spitzer',
      cpiAnnualPct: null,
      graceMonths: null,
    },
    {
      id: 'b',
      type: 'fixed_unlinked',
      amount: 400_000,
      annualRatePct: 0,
      termMonths: 4,
      repayment: 'spitzer',
      cpiAnnualPct: null,
      graceMonths: null,
    },
  ],
};

describe('aggregateMix', () => {
  it('aggregates monthly payment and balance curves across all tracks', () => {
    const result = aggregateMix(mix);

    expect(result.ltv).toBe(50);
    expect(result.firstPayment).toBe(150_000);
    expect(result.paymentCurve).toHaveLength(12);
    expect(result.balanceCurve.at(-1)?.value).toBe(0);
  });
});

