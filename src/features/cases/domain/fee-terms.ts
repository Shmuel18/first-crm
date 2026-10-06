/**
 * How the agreed fee (שכ״ט) is expressed in the מנהלה block (migration 248):
 * a fixed sum, or a percentage of the requested loan. For a percentage the
 * database derives the shekel sum, which is what collections and statistics
 * read either way.
 */
export type FeeBasis = 'fixed' | 'percent';

export type CaseFeeTerms = {
  /** The fee in shekels — the agreed sum, or the sum derived from `percent`. */
  amount: number | null;
  /** Set only for a percentage fee. */
  percent: number | null;
};

/**
 * A broker's fee is a few percent of the loan. Anything above this is a typo
 * (15 for 1.5) that would put a six-figure fee into collections.
 */
export const FEE_PERCENT_MAX = 10;

export function feeBasisOf(terms: CaseFeeTerms): FeeBasis {
  return terms.percent !== null ? 'percent' : 'fixed';
}
