import { BRAND } from '@/lib/brand';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatCurrency } from '@/lib/utils/format-currency';

import { estimatedFee } from '../domain/agreement-calc';
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

export type AgreementTerms = {
  language: AgreementLanguage;
  clientName: string;
  clientNationalId: string | null;
  feePercent: number;
  feeAdvance: number;
  loanAmount: number | null;
};

/**
 * The finished, placeholder-free document for these terms. Called once at send
 * time; the result is snapshotted onto the row so a later template edit cannot
 * change what an existing client was shown.
 */
export async function buildAgreementDocument(terms: AgreementTerms): Promise<AgreementDocument> {
  const template = await getAgreementTemplate(terms.language);
  const he = terms.language === 'he';
  const estimate = estimatedFee(terms.loanAmount, terms.feePercent);

  // A whole sentence, so it vanishes cleanly when the case has no loan figure.
  const estimateSentence =
    estimate === null || terms.loanAmount === null
      ? ''
      : he
        ? ` לצורך המחשה בלבד: על בסיס הלוואה בסך ${formatCurrency(terms.loanAmount, 'he')}, שכר הטרחה הוא כ-${formatCurrency(estimate, 'he')} בתוספת מע"מ.`
        : ` For illustration only: based on a loan of ${formatCurrency(terms.loanAmount, 'en')}, the professional fee would be approximately ${formatCurrency(estimate, 'en')} plus VAT.`;

  // No advance is a real arrangement (fee entirely at execution) — the clause
  // must say so rather than promising a payment of zero.
  const advanceSentence =
    terms.feeAdvance > 0
      ? he
        ? `לוח התשלומים: סך של ${formatCurrency(terms.feeAdvance, 'he')}, בתוספת מע"מ, ישולם במעמד חתימת הסכם זה וייחשב כתשלום על חשבון שכר הטרחה הכולל.`
        : `Payment Schedule: A sum of ${formatCurrency(terms.feeAdvance, 'en')}, plus VAT, shall be paid upon signing this Agreement and shall be credited towards the total professional fee.`
      : he
        ? 'לוח התשלומים: לא נדרשת מקדמה במעמד חתימת הסכם זה; שכר הטרחה במלואו ישולם במועדים הקבועים להלן.'
        : 'Payment Schedule: No advance is payable upon signing this Agreement; the professional fee shall be paid in full at the times set out below.';

  return renderAgreementDocument(template, {
    clientName: terms.clientName,
    clientNationalId: terms.clientNationalId ?? '____________',
    officeName: he ? BRAND.nameHe : BRAND.nameEn,
    officeRepresentative: he ? BRAND.representativeHe : BRAND.representativeEn,
    officeCrmDomain: BRAND.crmDomain,
    feePercent: formatFeePercent(terms.feePercent, terms.language),
    feeAdvance: formatCurrency(terms.feeAdvance, terms.language),
    feeAdvanceSentence: advanceSentence,
    feeEstimateSentence: estimateSentence,
  });
}
