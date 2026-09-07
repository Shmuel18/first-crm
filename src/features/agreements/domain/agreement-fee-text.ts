import type { AgreementLanguage } from './agreement-text';

/**
 * The fee sentences, as EDITABLE templates.
 *
 * The rest of the agreement is one document the office edits freely, but the
 * fee clauses cannot be: which sentence applies depends on the deal (a
 * percentage or a flat sum, an advance or none, an illustration or nothing to
 * illustrate). So the office edits each VARIANT, and the send picks between
 * them.
 *
 * Each template carries its own `{{placeholders}}`, filled at send time with
 * the pre-formatted figures — the office never types a number here.
 *
 * These defaults are the wording the office approved on 2026-09-06. A stored
 * override replaces them one sentence at a time (see mergeFeeSentences), so an
 * office that edits only the advance clause keeps the approved text everywhere
 * else. Editing wording never rewrites history: each send snapshots what it
 * printed onto its own row.
 */
export type FeeSentenceKey =
  | 'termsPercent'
  | 'termsFixed'
  | 'loanChangePercent'
  | 'loanChangeFixed'
  | 'advanceWithAmount'
  | 'advanceNone'
  | 'estimate';

export type FeeSentenceTemplates = Record<FeeSentenceKey, string>;

export const FEE_SENTENCE_KEYS: readonly FeeSentenceKey[] = [
  'termsPercent',
  'termsFixed',
  'loanChangePercent',
  'loanChangeFixed',
  'advanceWithAmount',
  'advanceNone',
  'estimate',
] as const;

/**
 * Placeholders a sentence MUST keep. A fee clause with the fee edited out of it
 * is not a fee clause — the save is refused rather than printing a contract
 * that states no price. Sentences with no required placeholder are free prose.
 */
export const REQUIRED_FEE_PLACEHOLDERS: Record<FeeSentenceKey, readonly string[]> = {
  termsPercent: ['feePercent'],
  termsFixed: ['feeAmount'],
  loanChangePercent: [],
  loanChangeFixed: [],
  advanceWithAmount: ['feeAdvance'],
  advanceNone: [],
  estimate: ['loanAmount', 'feeEstimate'],
};

const HEBREW: FeeSentenceTemplates = {
  termsPercent:
    'שכר טרחה בשיעור של {{feePercent}} מסכום ההלוואה הכולל שיועמד ללקוח בפועל, בתוספת מע"מ כדין.',
  termsFixed:
    'שכר טרחה קבוע בסך {{feeAmount}}, בתוספת מע"מ כדין, שאינו תלוי בסכום ההלוואה שיועמד בפועל.',
  loanChangePercent:
    'שינוי בסכום ההלוואה: ככל שסכום ההלוואה שיועמד בפועל יהיה שונה מהסכום שנבחן או התבקש בתחילת ההתקשרות, יחושב שכר הטרחה בהתאם לסכום ההלוואה שהועמד בפועל.',
  loanChangeFixed:
    'שינוי בסכום ההלוואה: שכר הטרחה הוא סכום קבוע ואינו משתנה בהתאם לסכום ההלוואה שיועמד בפועל.',
  advanceWithAmount:
    'לוח התשלומים: סך של {{feeAdvance}}, בתוספת מע"מ, ישולם במעמד חתימת הסכם זה וייחשב כתשלום על חשבון שכר הטרחה הכולל.',
  advanceNone:
    'לוח התשלומים: לא נדרשת מקדמה במעמד חתימת הסכם זה; שכר הטרחה במלואו ישולם במועדים הקבועים להלן.',
  estimate:
    'לצורך המחשה בלבד: על בסיס הלוואה בסך {{loanAmount}}, שכר הטרחה הוא כ-{{feeEstimate}} בתוספת מע"מ.',
};

const ENGLISH: FeeSentenceTemplates = {
  termsPercent:
    'a professional fee equal to {{feePercent}} of the total loan amount advanced, plus VAT as required by law.',
  termsFixed:
    'a fixed professional fee of {{feeAmount}}, plus VAT as required by law, which does not vary with the loan amount actually advanced.',
  loanChangePercent:
    'Change in Loan Amount: If the amount of the loan actually advanced differs from the amount initially considered or requested, the professional fee shall be calculated according to the amount actually advanced.',
  loanChangeFixed:
    'Change in Loan Amount: The professional fee is a fixed sum and does not change according to the amount of the loan actually advanced.',
  advanceWithAmount:
    'Payment Schedule: A sum of {{feeAdvance}}, plus VAT, shall be paid upon signing this Agreement and shall be credited towards the total professional fee.',
  advanceNone:
    'Payment Schedule: No advance is payable upon signing this Agreement; the professional fee shall be paid in full at the times set out below.',
  estimate:
    'For illustration only: based on a loan of {{loanAmount}}, the professional fee would be approximately {{feeEstimate}} plus VAT.',
};

export const DEFAULT_FEE_SENTENCES: Record<AgreementLanguage, FeeSentenceTemplates> = {
  he: HEBREW,
  en: ENGLISH,
};

/** True when the template keeps every placeholder its meaning depends on. */
export function feeSentenceIsComplete(key: FeeSentenceKey, template: string): boolean {
  return REQUIRED_FEE_PLACEHOLDERS[key].every((p) => template.includes(`{{${p}}}`));
}

/**
 * The office's wording for one language, sentence by sentence: a stored
 * override wins only where it is a usable string — anything blank, missing or
 * stripped of a required placeholder falls back to the approved default rather
 * than printing a broken clause.
 */
export function mergeFeeSentences(
  language: AgreementLanguage,
  stored: unknown,
): FeeSentenceTemplates {
  const defaults = DEFAULT_FEE_SENTENCES[language];
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return defaults;
  const record = stored as Record<string, unknown>;
  const merged = { ...defaults };
  for (const key of FEE_SENTENCE_KEYS) {
    const value = record[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed && feeSentenceIsComplete(key, trimmed)) merged[key] = trimmed;
  }
  return merged;
}
