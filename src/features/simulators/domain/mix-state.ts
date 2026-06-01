import type { MixResult, MoneyAgorot } from '../types';

export interface MonthState {
  month: number;
  closingBalance: MoneyAgorot;
  paidToDate: MoneyAgorot;
  principalReduced: MoneyAgorot;
  interestAndIndexationPaid: MoneyAgorot;
  monthlyPayment: MoneyAgorot;
  remainingToPay: MoneyAgorot;
}

/**
 * Snapshot of the mortgage at a given month. Principal-reduced is measured as
 * `original − remaining balance` (so CPI-indexed balance growth correctly
 * counts against it); everything else paid is interest + indexation. The two
 * always sum back to the cash paid to date.
 */
export function mortgageStateAtMonth(
  result: MixResult,
  mortgageAmount: MoneyAgorot,
  month: number,
): MonthState {
  const total = result.paymentCurve.length;
  const clamped = total === 0 ? 0 : Math.max(1, Math.min(Math.round(month), total));
  const paidToDate = result.paymentCurve
    .slice(0, clamped)
    .reduce((sum, point) => sum + point.value, 0);
  const closingBalance = result.balanceCurve[clamped - 1]?.value ?? mortgageAmount;
  const principalReduced = mortgageAmount - closingBalance;
  return {
    month: clamped,
    closingBalance,
    paidToDate,
    principalReduced,
    interestAndIndexationPaid: paidToDate - principalReduced,
    monthlyPayment: result.paymentCurve[clamped - 1]?.value ?? 0,
    remainingToPay: result.totalCost - paidToDate,
  };
}
