import { describe, expect, it } from 'vitest';

import { DEFAULT_REGULATORY_THRESHOLDS } from '../constants';
import { calculateMaximumMortgage } from './max-mortgage';

const baseInput = {
  netIncomeMonthly: 20_000,
  obligationsMonthly: 2_000,
  propertyValue: 2_000_000,
  equity: 500_000,
  annualRatePct: 0,
  termMonths: 300,
  propertyKind: 'first_home' as const,
  maxTotalDebtToIncomePct: 40,
  thresholds: DEFAULT_REGULATORY_THRESHOLDS,
};

describe('calculateMaximumMortgage', () => {
  it('solves maximum principal from payment cap and LTV/equity constraints', () => {
    const result = calculateMaximumMortgage(baseInput);

    expect(result.paymentCap).toBe(6_000);
    expect(result.maxByPayment).toBe(1_800_000);
    expect(result.maxByLtv).toBe(1_500_000);
    expect(result.maximumMortgageAmount).toBe(1_500_000);
    expect(result.bindingConstraint).toBe('ltv');
  });

  it('handles no available payment capacity', () => {
    const result = calculateMaximumMortgage({ ...baseInput, obligationsMonthly: 10_000 });

    expect(result.maxByPayment).toBe(0);
    expect(result.bindingConstraint).toBe('payment');
  });
});
