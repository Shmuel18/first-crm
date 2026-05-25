import type { ObligationRow } from '../types';

/** Sum of monthly_payment, treating null as 0. */
export function sumMonthlyPayments(
  rows: ReadonlyArray<Pick<ObligationRow, 'monthly_payment'>>,
): number {
  let total = 0;
  for (const r of rows) {
    if (typeof r.monthly_payment === 'number') total += r.monthly_payment;
  }
  return total;
}

/** Sum of loan_amount (current/original outstanding), treating null as 0. */
export function sumRemainingDebt(
  rows: ReadonlyArray<Pick<ObligationRow, 'loan_amount'>>,
): number {
  let total = 0;
  for (const r of rows) {
    if (typeof r.loan_amount === 'number') total += r.loan_amount;
  }
  return total;
}
