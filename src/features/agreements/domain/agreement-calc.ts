/**
 * The balance due at execution — always DERIVED from total − advance, never
 * stored separately, so the three numbers in the agreement can't disagree.
 */
export function agreementBalance(feeTotal: number, feeAdvance: number): number {
  return Math.max(0, feeTotal - feeAdvance);
}
