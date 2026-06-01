import { describe, expect, it } from 'vitest';

import { calculateClosingCosts } from './closing-costs';

describe('calculateClosingCosts', () => {
  it('sums fixed and percentage-based closing costs', () => {
    const result = calculateClosingCosts(500_000, 540_000, [
      { id: 'lawyer', label: 'Lawyer', amount: null, baseAmount: 2_000_000, ratePct: 0.5 },
      { id: 'appraisal', label: 'Appraisal', amount: 2_500, baseAmount: null, ratePct: null },
    ]);

    expect(result.totalCosts).toBe(12_500);
    expect(result.cashToClose).toBe(512_500);
    expect(result.financingGap).toBe(0);
  });

  it('returns financing gap when available cash is not enough', () => {
    const result = calculateClosingCosts(500_000, 500_000, [
      { id: 'tax', label: 'Purchase tax', amount: 30_000, baseAmount: null, ratePct: null },
    ]);

    expect(result.financingGap).toBe(30_000);
  });
});
