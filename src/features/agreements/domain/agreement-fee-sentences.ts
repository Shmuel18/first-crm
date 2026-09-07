import { formatCurrency } from '@/lib/utils/format-currency';

import { DEFAULT_FEE_SENTENCES } from './agreement-fee-text';
import { fillPlaceholders, formatFeePercent } from './render-agreement';

import type { AgreementFeeTerms } from './agreement-calc';
import type { FeeSentenceTemplates } from './agreement-fee-text';
import type { AgreementLanguage } from './agreement-text';

/**
 * The finished fee sentences for one deal.
 *
 * Kept as whole sentences rather than values: a percentage deal and a flat-sum
 * deal say different things, and "a fee of 0% of the loan" or "an advance of
 * ₪0 shall be paid" would be nonsense in a signed contract. Which variant
 * applies is decided here; the WORDING of each variant is the office's, edited
 * in Settings → Engagement agreement (domain/agreement-fee-text.ts).
 */
export type FeeSentences = {
  terms: string;
  loanChange: string;
  estimate: string;
};

type BuildInput = {
  terms: AgreementFeeTerms;
  language: AgreementLanguage;
  loanAmount: number | null;
  /** The percentage estimate, already computed by the caller. */
  estimate: number | null;
  /** The office's wording; defaults to the approved text. */
  templates?: FeeSentenceTemplates;
};

/** Every fee sentence for one deal, in the agreement's language. */
export function buildFeeSentences({
  terms,
  language,
  loanAmount,
  estimate,
  templates = DEFAULT_FEE_SENTENCES[language],
}: BuildInput): FeeSentences {
  const isPercent = terms.basis === 'percent';
  // Only the variant's own placeholder is supplied: a percentage sentence has
  // no amount to fill, and vice versa — the other would print as itself, which
  // is exactly the visible-typo behaviour the renderer wants.
  const feeVars: Record<string, string> =
    terms.basis === 'percent'
      ? { feePercent: formatFeePercent(terms.feePercent, language) }
      : { feeAmount: formatCurrency(terms.feeAmount, language) };

  return {
    terms: fillPlaceholders(isPercent ? templates.termsPercent : templates.termsFixed, feeVars),
    loanChange: isPercent ? templates.loanChangePercent : templates.loanChangeFixed,
    estimate: estimateSentence({ terms, language, loanAmount, estimate, templates }),
  };
}

/**
 * The illustrative "on a loan of X the fee is about Y" sentence. Empty for a
 * fixed fee (nothing is being estimated) and whenever the case carries no loan
 * figure, so the clause disappears instead of printing a dangling estimate.
 *
 * The leading space is added HERE rather than stored in the template: the
 * sentence is appended mid-paragraph, and an office editing the text should not
 * have to know that a missing space would glue it to the previous word.
 */
function estimateSentence({
  terms,
  language,
  loanAmount,
  estimate,
  templates,
}: Required<Omit<BuildInput, 'templates'>> & { templates: FeeSentenceTemplates }): string {
  if (terms.basis === 'fixed' || estimate === null || loanAmount === null) return '';
  const filled = fillPlaceholders(templates.estimate, {
    loanAmount: formatCurrency(loanAmount, language),
    feeEstimate: formatCurrency(estimate, language),
  }).trim();
  return filled ? ` ${filled}` : '';
}

/**
 * The payment-schedule sentence. No advance is a real arrangement (fee entirely
 * at execution), so the clause says so rather than promising a payment of zero.
 */
export function advanceSentence(
  feeAdvance: number,
  language: AgreementLanguage,
  templates: FeeSentenceTemplates = DEFAULT_FEE_SENTENCES[language],
): string {
  if (feeAdvance <= 0) return templates.advanceNone;
  return fillPlaceholders(templates.advanceWithAmount, {
    feeAdvance: formatCurrency(feeAdvance, language),
  });
}
