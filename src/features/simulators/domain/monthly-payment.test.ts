import { describe, expect, it } from 'vitest';

import { calculateMonthlyPayment } from './monthly-payment';

describe('calculateMonthlyPayment', () => {
  it('returns a full payment summary for a simple Spitzer track', () => {
    const result = calculateMonthlyPayment({
      id: 'quick',
      type: 'fixed_unlinked',
      amount: 120_000,
      annualRatePct: 0,
      termMonths: 12,
      repayment: 'spitzer',
      cpiAnnualPct: null,
      graceMonths: null,
    });

    expect(result.firstPayment).toBe(10_000);
    expect(result.averagePayment).toBe(10_000);
    expect(result.rows).toHaveLength(12);
    expect(result.rows.at(-1)?.closingBalance).toBe(0);
  });
});
