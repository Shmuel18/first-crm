/**
 * How the office charges for this engagement.
 *
 * `percent` is the house default (the fee follows the loan actually advanced).
 * `fixed` is a flat sum agreed up front — a real arrangement for small
 * refinances and partial support, where a percentage of the loan is either
 * meaningless or not what was agreed.
 */
export type AgreementFeeTerms =
  | { basis: 'percent'; feePercent: number }
  | { basis: 'fixed'; feeAmount: number };

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
 * The shekel figure the client reads as the fee: an ESTIMATE for a percentage
 * deal (null when the case has no loan amount), and the agreed sum itself for
 * a fixed one — where nothing is estimated and the loan amount is irrelevant.
 */
export function printedFeeAmount(
  terms: AgreementFeeTerms,
  loanAmount: number | null,
): number | null {
  if (terms.basis === 'fixed') return terms.feeAmount;
  return estimatedFee(loanAmount, terms.feePercent);
}

/**
 * What is left to pay at execution: the printed fee minus the advance already
 * paid at signing. Null whenever the fee is unknown; never negative.
 */
export function estimatedBalance(estimate: number | null, feeAdvance: number): number | null {
  if (estimate === null) return null;
  return Math.max(0, estimate - feeAdvance);
}

/**
 * The terms a past agreement was sent with, so a re-send can repeat them
 * instead of making the sender retype the deal. A row carrying a percentage is
 * a percentage deal; one carrying only a total is a fixed-fee deal.
 */
export function agreementFeeTerms(row: {
  feePercent: number | null;
  feeTotal: number | null;
}): AgreementFeeTerms | null {
  if (row.feePercent !== null && row.feePercent > 0) {
    return { basis: 'percent', feePercent: row.feePercent };
  }
  if (row.feeTotal !== null && row.feeTotal > 0) {
    return { basis: 'fixed', feeAmount: row.feeTotal };
  }
  return null;
}
