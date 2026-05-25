import type { IncomeRow } from '../types';

/**
 * Sum monthly amounts across a list of incomes. Treats null/undefined as zero
 * so partially-filled records still contribute their known amounts.
 *
 * Numbers come back from PostgREST as JS `number` for NUMERIC(15,2) — fine for
 * sums under a few billion, which mortgage incomes never approach.
 */
export function sumMonthlyIncomes(incomes: ReadonlyArray<Pick<IncomeRow, 'amount_monthly'>>): number {
  let total = 0;
  for (const i of incomes) {
    if (typeof i.amount_monthly === 'number') total += i.amount_monthly;
  }
  return total;
}
