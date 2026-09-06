import type { DocumentChecklistItem } from '../services/document-checklist.service';

/** Lookup for one message string, supplied by the caller (next-intl `t`). */
type Translate = (key: string, values?: Record<string, string>) => string;

type Base = {
  /** Who the message greets. */
  name: string;
  checklist: ReadonlyArray<DocumentChecklistItem> | null;
  locale: 'he' | 'en';
};

/** Required documents the case is still waiting for. */
function missingRequired(
  checklist: ReadonlyArray<DocumentChecklistItem> | null,
): DocumentChecklistItem[] {
  return (checklist ?? []).filter((i) => i.isRequired && i.status === 'missing');
}

/**
 * Prefill for the editable email draft — greeting, ask, missing-required-docs
 * bullets and a signoff, in the advisor's UI language. Mirrors the WhatsApp
 * builder below so both channels start from the same message.
 */
export function buildDocRequestEmailText({
  name,
  checklist,
  locale,
  office,
  t,
}: Base & { office: string; t: Translate }): string {
  const missing = missingRequired(checklist);
  const lines = [t('emailGreeting', { name }), '', t('emailBody')];
  if (missing.length > 0) {
    lines.push('', t('emailDocsIntro'));
    for (const item of missing) lines.push(`• ${locale === 'he' ? item.nameHe : item.nameEn}`);
  }
  lines.push('', t('emailSignoff', { office }));
  return lines.join('\n');
}

/**
 * The prefilled WhatsApp message: the missing required docs as bullets in the
 * current locale, or a generic "we need more documents, get back to me" when
 * the checklist is empty or everything required is already in.
 */
export function buildDocRequestWhatsappText({
  name,
  checklist,
  locale,
  t,
}: Base & { t: Translate }): string {
  const missing = missingRequired(checklist);
  if (missing.length === 0) return t('whatsappTemplateNoMissing', { name });
  const docList = missing.map((i) => `- ${locale === 'he' ? i.nameHe : i.nameEn}`).join('\n');
  return t('whatsappTemplate', { name, docList });
}
