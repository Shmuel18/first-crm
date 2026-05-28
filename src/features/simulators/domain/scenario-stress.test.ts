import { describe, expect, it } from 'vitest';

import { stressMix } from './scenario-stress';

import type { MixInput } from '../types';

const mix: MixInput = {
  mortgageAmount: 1_000_000,
  propertyValue: 2_000_000,
  equity: 1_000_000,
  defaultTermMonths: 24,
  tracks: [
    {
      id: 'prime',
      type: 'prime',
      amount: 1_000_000,
      annualRatePct: 4,
      termMonths: 24,
      repayment: 'spitzer',
      cpiAnnualPct: null,
      graceMonths: null,
    },
  ],
};

describe('stressMix', () => {
  it('applies rate shocks from the configured change month', () => {
    const baselineOnly = stressMix(mix, {
      primeDeltaPct: 6,
      variableDeltaPct: 0,
      cpiAnnualPct: 0,
      changeMonth: 13,
      paymentThreshold: null,
    });
    const result = stressMix(mix, {
      primeDeltaPct: 6,
      variableDeltaPct: 0,
      cpiAnnualPct: 0,
      changeMonth: 13,
      paymentThreshold: baselineOnly.baseline.maxPayment,
    });

    expect(result.stressed.paymentCurve[0]?.value).toBe(result.baseline.paymentCurve[0]?.value);
    expect(result.stressed.maxPayment).toBeGreaterThan(result.baseline.maxPayment);
    expect(result.thresholdCrossMonth).toBe(13);
  });
});
