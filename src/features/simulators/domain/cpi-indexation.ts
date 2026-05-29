import { roundAgorot } from './money';
import { monthlyCpiRate } from './rate';

import type { MoneyAgorot } from '../types';

export interface IndexedBalance {
  balance: MoneyAgorot;
  indexation: MoneyAgorot;
}

export function applyMonthlyIndexation(
  balance: MoneyAgorot,
  cpiAnnualPct: number | null,
): IndexedBalance {
  const indexed = roundAgorot(balance * (1 + monthlyCpiRate(cpiAnnualPct)));
  return { balance: indexed, indexation: Math.max(0, indexed - balance) };
}

