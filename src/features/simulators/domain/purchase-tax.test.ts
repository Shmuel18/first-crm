import { describe, expect, it } from 'vitest';

import { calculatePurchaseTax, type PurchaseTaxBracket } from './purchase-tax';

const brackets: PurchaseTaxBracket[] = [
  { fromAmount: 0, toAmount: 2_000_000, ratePct: 0 },
  { fromAmount: 2_000_000, toAmount: 3_000_000, ratePct: 3.5 },
  { fromAmount: 3_000_000, toAmount: null, ratePct: 5 },
];

describe('calculatePurchaseTax', () => {
  it('calculates progressive purchase tax brackets', () => {
    const result = calculatePurchaseTax(3_500_000, brackets);

    expect(result.totalTax).toBe(60_000);
    expect(result.brackets.map((row) => row.taxAmount)).toEqual([0, 35_000, 25_000]);
  });

  it('supports partial ownership share', () => {
    expect(calculatePurchaseTax(3_500_000, brackets, 50).totalTax).toBe(0);
  });
});
