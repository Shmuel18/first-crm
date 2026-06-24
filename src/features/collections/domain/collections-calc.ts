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
