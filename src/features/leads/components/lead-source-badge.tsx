import { useTranslations } from 'next-intl';

import { leadSource } from '../domain/lead-source';

const STYLES = {
  contact: 'bg-sky-100 text-sky-700',
  questionnaire: 'bg-brand-gold/15 text-brand-gold-text',
} as const;

/** Small chip showing how a lead arrived (quick contact vs full questionnaire). */
export function LeadSourceBadge({ metadata }: { metadata: unknown }) {
  const t = useTranslations('leads.source');
  const source = leadSource(metadata);
  if (source === 'manual') return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[source]}`}
    >
      {t(source)}
    </span>
  );
}
