import type { RiskLevel } from '../types';

export function scoreRisk(paymentIncreasePct: number, linkedPrincipalGrowthPct: number): RiskLevel {
  if (paymentIncreasePct >= 20 || linkedPrincipalGrowthPct >= 10) return 'high';
  if (paymentIncreasePct >= 10 || linkedPrincipalGrowthPct >= 5) return 'medium';
  return 'low';
}

