import type { CollectionStatus } from '../types';

/** Sum of a ledger's payment amounts (₪). Non-finite entries are ignored. */
export function sumCollected(amounts: readonly number[]): number {
  return amounts.reduce((acc, n) => (Number.isFinite(n) ? acc + n : acc), 0);
}

/**
 * Remaining fee to collect: agreed fee − collected. Negative when overpaid.
 * A null/zero agreed fee yields a 0 balance (nothing to collect against yet).
 */
export function collectionBalance(feeAmount: number | null, collected: number): number {
  if (feeAmount == null || feeAmount <= 0) return 0;
  return feeAmount - collected;
}

/** not_started → partial → collected, plus an overpaid guard. */
export function collectionStatus(feeAmount: number | null, collected: number): CollectionStatus {
  if (feeAmount != null && feeAmount > 0 && collected > feeAmount) return 'overpaid';
  if (collected <= 0) return 'not_started';
  if (feeAmount == null || feeAmount <= 0) return 'partial';
  if (collected >= feeAmount) return 'collected';
  return 'partial';
}

/** Collection progress as a clamped 0–100 percentage (for the balance bar). */
export function collectionProgressPct(feeAmount: number | null, collected: number): number {
  if (feeAmount == null || feeAmount <= 0) return collected > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((collected / feeAmount) * 100)));
}

/** Net profit on a case: collected − office expenses. */
export function netProfit(collected: number, expenses: number): number {
  return collected - expenses;
}

// ---------------------------------------------------------------------------
// Shared outstanding-balance logic — the single source of truth for BOTH the
// central /collections dashboard and the in-case מנהלה block, so the two agree.
// Payments cover office expenses first, then the fee-due. The advance (מקדמה) is
// the upfront PORTION OF the fee (not an extra amount): pre-execution only the
// advance is due, at/after execution the whole fee is. So the advance is never
// added on top of the fee — that would double-count it.
// ---------------------------------------------------------------------------

/** Office expenses still to collect (payments cover expenses first). */
export function expenseBalance(expenses: number, collected: number): number {
  return Math.max(0, expenses - collected);
}

/**
 * Advisory fee still to collect. The advance is the upfront part OF the fee, so
 * pre-execution only the advance is due; at/after execution the whole fee is.
 * Payments cover expenses first, so only the surplus above expenses reduces it.
 */
export function feeBalanceDue(
  feeAmount: number | null,
  advance: number,
  expenses: number,
  collected: number,
  isExecution: boolean,
): number {
  const fee = feeAmount ?? 0;
  // The advance is a milestone WITHIN the fee, so it never exceeds it.
  const feeDueNow = isExecution ? fee : Math.min(Math.max(0, advance), fee);
  return Math.max(0, feeDueNow - Math.max(0, collected - expenses));
}

/** Everything still to collect on a case now: unpaid fee-due (advance pre-
 *  execution, full fee at execution) + unpaid office expenses. The advance is
 *  part of the fee — never added on top. */
export function outstandingBalance(
  feeAmount: number | null,
  advance: number,
  expenses: number,
  collected: number,
  isExecution: boolean,
): number {
  return (
    feeBalanceDue(feeAmount, advance, expenses, collected, isExecution) +
    expenseBalance(expenses, collected)
  );
}
