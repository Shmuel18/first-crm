import { roundAgorot, sumMoney } from './money';

import type { MoneyAgorot } from '../types';

export interface ClosingCostLineItem {
  id: string;
  label: string;
  amount: MoneyAgorot | null;
  baseAmount: MoneyAgorot | null;
  ratePct: number | null;
}

export interface ClosingCostResultItem extends ClosingCostLineItem {
  calculatedAmount: MoneyAgorot;
}

export interface ClosingCostsResult {
  items: ReadonlyArray<ClosingCostResultItem>;
  totalCosts: MoneyAgorot;
  cashToClose: MoneyAgorot;
  financingGap: MoneyAgorot;
}

export function calculateClosingCosts(
  equity: MoneyAgorot,
  availableCash: MoneyAgorot,
  items: ReadonlyArray<ClosingCostLineItem>,
): ClosingCostsResult {
  const calculated = items.map(calculateLineItem);
  const totalCosts = sumMoney(calculated.map((item) => item.calculatedAmount));
  const cashToClose = Math.max(0, equity) + totalCosts;
  return { items: calculated, totalCosts, cashToClose, financingGap: Math.max(0, cashToClose - availableCash) };
}

function calculateLineItem(item: ClosingCostLineItem): ClosingCostResultItem {
  if (item.amount !== null) return { ...item, calculatedAmount: Math.max(0, item.amount) };
  if (item.baseAmount !== null && item.ratePct !== null) {
    return { ...item, calculatedAmount: roundAgorot(item.baseAmount * (item.ratePct / 100)) };
  }
  return { ...item, calculatedAmount: 0 };
}
