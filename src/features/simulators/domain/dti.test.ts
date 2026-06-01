import { describe, expect, it } from 'vitest';

import { calculateDtiScenario } from './dti';

describe('calculateDtiScenario', () => {
  it('calculates payment and total debt ratios', () => {
    const result = calculateDtiScenario({
      netIncomeMonthly: 20_000,
      obligationsMonthly: 2_000,
      proposedMortgagePayment: 6_000,
      stressMortgagePayment: 8_000,
      maxTotalDebtToIncomePct: 40,
      warningTotalDebtToIncomePct: 35,
    });

    expect(result.paymentToIncomePct).toBe(30);
    expect(result.totalDebtToIncomePct).toBe(40);
    expect(result.stressTotalDebtToIncomePct).toBe(50);
    expect(result.maxMortgagePaymentByDebtRatio).toBe(6_000);
  });

  it('does not divide by zero when income is missing', () => {
    const result = calculateDtiScenario({
      netIncomeMonthly: 0,
      obligationsMonthly: 1_000,
      proposedMortgagePayment: 2_000,
      maxTotalDebtToIncomePct: 40,
      warningTotalDebtToIncomePct: 35,
    });

    expect(result.riskLevel).toBe('missing_income');
    expect(result.totalDebtToIncomePct).toBeNull();
  });
});
