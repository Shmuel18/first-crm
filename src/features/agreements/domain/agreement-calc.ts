/**
 * The printed fee estimate: the agreed percentage applied to the loan the case
 * currently expects. Returns null when there is no loan figure on file — the
 * agreement then states the percentage alone, which is the authoritative term
 * anyway (the fee bills on the amount actually advanced).
 */
export function estimatedFee(loanAmount: number | null, feePercent: number | null): number | null {
  if (loanAmount === null || feePercent === null) return null;
  if (!Number.isFinite(loanAmount) || !Number.isFinite(feePercent)) return null;
  if (loanAmount <= 0 || feePercent <= 0) return null;
  return Math.round((loanAmount * feePercent) / 100);
}

/**
 * What is left to pay at execution: the estimate minus the advance already
 * paid at signing. Null whenever the estimate is unknown; never negative.
 */
export function estimatedBalance(
  estimate: number | null,
  feeAdvance: number,
): number | null {
  if (estimate === null) return null;
  return Math.max(0, estimate - feeAdvance);
}
