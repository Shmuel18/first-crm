import type { AgreementDocument, AgreementLanguage } from './agreement-text';

/** Every placeholder the agreement wording may use. */
export type AgreementVars = {
  clientName: string;
  clientNationalId: string;
  officeName: string;
  officeRepresentative: string;
  officeCrmDomain: string;
  /** Pre-formatted, e.g. "1.5%". */
  feePercent: string;
  /** Pre-formatted currency, e.g. "5,000 ₪". */
  feeAdvance: string;
  /**
   * The whole payment-schedule sentence. A sentence rather than a value
   * because "an advance of ₪0 shall be paid on signing" is nonsense in a
   * contract — with no advance the clause states the opposite instead.
   */
  feeAdvanceSentence: string;
  /**
   * The whole "based on a loan of X the fee is about Y" sentence, or '' when
   * the case has no loan figure (and always for a fixed fee, which is not an
   * estimate). A sentence rather than a value so the wording disappears
   * cleanly instead of leaving a dangling "(about —)".
   */
  feeEstimateSentence: string;
  /**
   * The whole fee clause — "a fee of 1.5% of the loan advanced" or "a fixed fee
   * of X". A sentence because a percentage deal and a flat-sum deal cannot be
   * expressed by swapping one value into shared prose.
   */
  feeTermsSentence: string;
  /**
   * The whole "change in loan amount" clause: recalculation on a percentage
   * deal, and an explicit "the fee does not change" on a fixed one.
   */
  feeLoanChangeSentence: string;
};

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/**
 * Substitute `{{name}}` from a flat map of pre-formatted strings. Shared by the
 * document render and the fee-sentence render, so both treat an unknown
 * placeholder the same way.
 *
 * An unknown placeholder is left VISIBLE on purpose: a typo in the office's
 * edited wording must be obvious to whoever proofreads the draft, not silently
 * blanked out of a legal document.
 */
export function fillPlaceholders(text: string, vars: Readonly<Record<string, string>>): string {
  return text.replace(PLACEHOLDER, (match, key: string) =>
    Object.hasOwn(vars, key) ? (vars[key] ?? match) : match,
  );
}

function fill(text: string, vars: AgreementVars): string {
  return fillPlaceholders(text, vars);
}

/**
 * Substitute the placeholders throughout a document. The result is what the
 * client is shown AND what gets snapshotted onto the agreement row — after
 * this point the text is frozen prose with no variables left to resolve.
 */
export function renderAgreementDocument(
  doc: AgreementDocument,
  vars: AgreementVars,
): AgreementDocument {
  return {
    title: fill(doc.title, vars),
    preamble: fill(doc.preamble, vars),
    sections: doc.sections.map((s) => ({
      title: fill(s.title, vars),
      paragraphs: s.paragraphs.map((p) => fill(p, vars).replace(/\s+([.,;])/g, '$1').trim()),
    })),
  };
}

/** Percent as printed: trims trailing zeros (1.500 → "1.5%"). */
export function formatFeePercent(percent: number, language: AgreementLanguage): string {
  const n = new Intl.NumberFormat(language === 'he' ? 'he-IL' : 'en-US', {
    maximumFractionDigits: 3,
  }).format(percent);
  return `${n}%`;
}
