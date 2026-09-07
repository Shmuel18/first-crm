import { BRAND } from '@/lib/brand';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatCurrency } from '@/lib/utils/format-currency';

import { estimatedFee, type AgreementFeeTerms } from '../domain/agreement-calc';
import { advanceSentence, buildFeeSentences } from '../domain/agreement-fee-sentences';
import { mergeFeeSentences, type FeeSentenceTemplates } from '../domain/agreement-fee-text';
import { DEFAULT_AGREEMENT_TEXT } from '../domain/agreement-text';
import { formatFeePercent, renderAgreementDocument } from '../domain/render-agreement';

import type { AgreementDocument, AgreementLanguage } from '../domain/agreement-text';

/** Shape of a stored override; anything malformed falls back to the default. */
function isAgreementDocument(value: unknown): value is AgreementDocument {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.title === 'string' &&
    typeof v.preamble === 'string' &&
    Array.isArray(v.sections) &&
    v.sections.every(
      (s) =>
        s &&
        typeof s === 'object' &&
        typeof (s as Record<string, unknown>).title === 'string' &&
        Array.isArray((s as Record<string, unknown>).paragraphs) &&
        ((s as Record<string, unknown>).paragraphs as unknown[]).every((p) => typeof p === 'string'),
    )
  );
}

/**
 * The office's active wording for a language: their edited override if one is
 * stored and well-formed, else the default shipped in the domain layer.
 *
 * Read with the service-role client because the public /sign page has no
 * session — office_settings is admin-gated under RLS, and the agreement text
 * is not a secret (it is literally shown to the client).
 */
export async function getAgreementTemplate(
  language: AgreementLanguage,
): Promise<AgreementDocument> {
  const fallback = DEFAULT_AGREEMENT_TEXT[language];
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('office_settings')
      .select('agreement_text')
      .limit(1)
      .maybeSingle();
    if (error || !data?.agreement_text) return fallback;
    const stored = (data.agreement_text as Record<string, unknown>)[language];
    return isAgreementDocument(stored) ? stored : fallback;
  } catch (err) {
    console.error('[agreements] template read failed, using default', err);
    return fallback;
  }
}

/**
 * The office's fee sentences for a language, each falling back to the approved
 * default when it was never edited (or was edited into something unusable).
 * Same service-role read as the document wording, for the same reason.
 */
export async function getAgreementFeeSentences(
  language: AgreementLanguage,
): Promise<FeeSentenceTemplates> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('office_settings')
      .select('agreement_fee_text')
      .limit(1)
      .maybeSingle();
    if (error || !data?.agreement_fee_text) return mergeFeeSentences(language, null);
    const stored = (data.agreement_fee_text as Record<string, unknown>)[language];
    return mergeFeeSentences(language, stored);
  } catch (err) {
    console.error('[agreements] fee wording read failed, using defaults', err);
    return mergeFeeSentences(language, null);
  }
}

/**
 * Wording saved before fixed fees existed states the fee as "…at a rate of
 * {{feePercent}}…", which is simply false for a flat-sum deal. Rather than
 * print a wrong commercial term, a fixed-fee send falls back to the current
 * default wording, which carries both variants.
 */
function usableForFixedFee(doc: AgreementDocument): boolean {
  const text = [doc.preamble, ...doc.sections.flatMap((s) => s.paragraphs)].join(' ');
  return text.includes('{{feeTermsSentence}}') && !text.includes('{{feePercent}}');
}

export type AgreementTerms = {
  language: AgreementLanguage;
  clientName: string;
  clientNationalId: string | null;
  /** Percentage of the loan, or a flat sum agreed up front. */
  fee: AgreementFeeTerms;
  feeAdvance: number;
  loanAmount: number | null;
};

/**
 * The finished, placeholder-free document for these terms. Called once at send
 * time; the result is snapshotted onto the row so a later template edit cannot
 * change what an existing client was shown.
 */
export async function buildAgreementDocument(terms: AgreementTerms): Promise<AgreementDocument> {
  const [stored, feeTemplates] = await Promise.all([
    getAgreementTemplate(terms.language),
    getAgreementFeeSentences(terms.language),
  ]);
  const template =
    terms.fee.basis === 'fixed' && !usableForFixedFee(stored)
      ? DEFAULT_AGREEMENT_TEXT[terms.language]
      : stored;

  const estimate =
    terms.fee.basis === 'percent' ? estimatedFee(terms.loanAmount, terms.fee.feePercent) : null;
  const fee = buildFeeSentences({
    terms: terms.fee,
    language: terms.language,
    loanAmount: terms.loanAmount,
    estimate,
    templates: feeTemplates,
  });
  const he = terms.language === 'he';

  return renderAgreementDocument(template, {
    clientName: terms.clientName,
    clientNationalId: terms.clientNationalId ?? '____________',
    officeName: he ? BRAND.nameHe : BRAND.nameEn,
    officeRepresentative: he ? BRAND.representativeHe : BRAND.representativeEn,
    officeCrmDomain: BRAND.crmDomain,
    // Kept for wording the office saved before fixed fees existed; a fixed-fee
    // send never reaches such a template (see usableForFixedFee).
    feePercent:
      terms.fee.basis === 'percent' ? formatFeePercent(terms.fee.feePercent, terms.language) : '',
    feeAdvance: formatCurrency(terms.feeAdvance, terms.language),
    feeAdvanceSentence: advanceSentence(terms.feeAdvance, terms.language, feeTemplates),
    feeTermsSentence: fee.terms,
    feeLoanChangeSentence: fee.loanChange,
    feeEstimateSentence: fee.estimate,
  });
}
