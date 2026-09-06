import { formatCurrency } from '@/lib/utils/format-currency';

import { formatFeePercent } from './render-agreement';

import type { AgreementFeeTerms } from './agreement-calc';
import type { AgreementLanguage } from './agreement-text';

/**
 * The three fee sentences the agreement is assembled from, per deal.
 *
 * Kept as whole sentences rather than values: a percentage deal and a flat-sum
 * deal say different things, and "a fee of 0% of the loan" or "an advance of
 * ₪0 shall be paid" would be nonsense in a signed contract.
 *
 * The office APPROVED the Hebrew flat-sum clauses on 2026-09-06. The English
 * pair mirrors them and was not reviewed separately — send it for review before
 * the first English fixed-fee agreement goes out.
 *
 * These are legal DATA like the rest of the wording: any edit here REQUIRES
 * bumping AGREEMENT_VERSION in ../constants.
 */
export type FeeSentences = {
  terms: string;
  loanChange: string;
  estimate: string;
};

/** The fee clause itself. */
function termsSentence(terms: AgreementFeeTerms, language: AgreementLanguage): string {
  const he = language === 'he';
  if (terms.basis === 'percent') {
    const pct = formatFeePercent(terms.feePercent, language);
    return he
      ? `שכר טרחה בשיעור של ${pct} מסכום ההלוואה הכולל שיועמד ללקוח בפועל, בתוספת מע"מ כדין.`
      : `a professional fee equal to ${pct} of the total loan amount advanced, plus VAT as required by law.`;
  }
  // Flat-sum engagement: no percentage appears anywhere in the document.
  const amount = formatCurrency(terms.feeAmount, language);
  return he
    ? `שכר טרחה קבוע בסך ${amount}, בתוספת מע"מ כדין, שאינו תלוי בסכום ההלוואה שיועמד בפועל.`
    : `a fixed professional fee of ${amount}, plus VAT as required by law, which does not vary with the loan amount actually advanced.`;
}

/** What happens to the fee when the loan actually advanced differs. */
function loanChangeSentence(terms: AgreementFeeTerms, language: AgreementLanguage): string {
  const he = language === 'he';
  if (terms.basis === 'percent') {
    return he
      ? 'שינוי בסכום ההלוואה: ככל שסכום ההלוואה שיועמד בפועל יהיה שונה מהסכום שנבחן או התבקש בתחילת ההתקשרות, יחושב שכר הטרחה בהתאם לסכום ההלוואה שהועמד בפועל.'
      : 'Change in Loan Amount: If the amount of the loan actually advanced differs from the amount initially considered or requested, the professional fee shall be calculated according to the amount actually advanced.';
  }
  // A flat sum cannot be recalculated, so this clause says the opposite of its
  // percentage twin rather than disappearing.
  return he
    ? 'שינוי בסכום ההלוואה: שכר הטרחה הוא סכום קבוע ואינו משתנה בהתאם לסכום ההלוואה שיועמד בפועל.'
    : 'Change in Loan Amount: The professional fee is a fixed sum and does not change according to the amount of the loan actually advanced.';
}

/**
 * The illustrative "on a loan of X the fee is about Y" sentence. Empty for a
 * fixed fee (nothing is being estimated) and whenever the case carries no loan
 * figure, so the clause disappears instead of printing a dangling estimate.
 */
function estimateSentence(
  terms: AgreementFeeTerms,
  language: AgreementLanguage,
  loanAmount: number | null,
  estimate: number | null,
): string {
  if (terms.basis === 'fixed' || estimate === null || loanAmount === null) return '';
  const he = language === 'he';
  const loan = formatCurrency(loanAmount, language);
  const fee = formatCurrency(estimate, language);
  return he
    ? ` לצורך המחשה בלבד: על בסיס הלוואה בסך ${loan}, שכר הטרחה הוא כ-${fee} בתוספת מע"מ.`
    : ` For illustration only: based on a loan of ${loan}, the professional fee would be approximately ${fee} plus VAT.`;
}

/** Every fee sentence for one deal, in the agreement's language. */
export function buildFeeSentences({
  terms,
  language,
  loanAmount,
  estimate,
}: {
  terms: AgreementFeeTerms;
  language: AgreementLanguage;
  loanAmount: number | null;
  /** The percentage estimate, already computed by the caller. */
  estimate: number | null;
}): FeeSentences {
  return {
    terms: termsSentence(terms, language),
    loanChange: loanChangeSentence(terms, language),
    estimate: estimateSentence(terms, language, loanAmount, estimate),
  };
}

/**
 * The payment-schedule sentence. No advance is a real arrangement (fee entirely
 * at execution), so the clause says so rather than promising a payment of zero.
 */
export function advanceSentence(feeAdvance: number, language: AgreementLanguage): string {
  const he = language === 'he';
  if (feeAdvance > 0) {
    const amount = formatCurrency(feeAdvance, language);
    return he
      ? `לוח התשלומים: סך של ${amount}, בתוספת מע"מ, ישולם במעמד חתימת הסכם זה וייחשב כתשלום על חשבון שכר הטרחה הכולל.`
      : `Payment Schedule: A sum of ${amount}, plus VAT, shall be paid upon signing this Agreement and shall be credited towards the total professional fee.`;
  }
  return he
    ? 'לוח התשלומים: לא נדרשת מקדמה במעמד חתימת הסכם זה; שכר הטרחה במלואו ישולם במועדים הקבועים להלן.'
    : 'Payment Schedule: No advance is payable upon signing this Agreement; the professional fee shall be paid in full at the times set out below.';
}
