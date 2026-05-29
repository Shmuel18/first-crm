import type { Locale } from '@/lib/i18n/direction';

import type { MoneyAgorot } from '../types';

/**
 * Locale-aware value formatters for the client report PDF. Money is held in
 * agorot internally (see the engine) and rounded to whole shekels here — the
 * report is a presentation surface, not a calculation one.
 */
function intlLocale(locale: Locale): string {
  return locale === 'he' ? 'he-IL' : 'en-GB';
}

export function fmtAgorot(value: MoneyAgorot, locale: Locale): string {
  return `${Math.round(value / 100).toLocaleString(intlLocale(locale))} ₪`;
}

export function fmtPct(value: number | null, locale: Locale, dash = '—'): string {
  if (value === null || !Number.isFinite(value)) return dash;
  return `${value.toLocaleString(intlLocale(locale), { maximumFractionDigits: 1 })}%`;
}

export function fmtDate(iso: string | null, locale: Locale, dash = '—'): string {
  if (!iso) return dash;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? dash : d.toLocaleDateString(intlLocale(locale));
}
