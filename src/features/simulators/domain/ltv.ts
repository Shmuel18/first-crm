import type { MoneyAgorot, PropertyKind, RegulatoryThresholds } from '../types';

export type LtvStatus = 'valid' | 'exceeded' | 'missing_value';

export interface LtvResult {
  ltvPct: number | null;
  maxMortgageAmount: MoneyAgorot;
  excessAmount: MoneyAgorot;
  requiredEquity: MoneyAgorot;
  status: LtvStatus;
}

export function calculateLtvScenario(
  propertyValue: MoneyAgorot,
  mortgageAmount: MoneyAgorot,
  propertyKind: PropertyKind,
  thresholds: RegulatoryThresholds,
): LtvResult {
  const limitPct = thresholds.maxLtvPct[propertyKind];
  if (propertyValue <= 0) return missingLtvResult();
  const maxMortgageAmount = Math.floor((propertyValue * limitPct) / 100);
  const excessAmount = Math.max(0, mortgageAmount - maxMortgageAmount);
  return {
    ltvPct: (mortgageAmount / propertyValue) * 100,
    maxMortgageAmount,
    excessAmount,
    requiredEquity: Math.max(0, propertyValue - maxMortgageAmount),
    status: excessAmount > 0 ? 'exceeded' : 'valid',
  };
}

function missingLtvResult(): LtvResult {
  return { ltvPct: null, maxMortgageAmount: 0, excessAmount: 0, requiredEquity: 0, status: 'missing_value' };
}
