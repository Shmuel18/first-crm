import type { Locale } from '@/lib/i18n/direction';

/**
 * Short date — d/M/yyyy. Used for inline displays (table cells, tooltips,
 * card subtitles). Picks `he-IL` for Hebrew and `en-GB` for English so both
 * sides get day-month-year ordering (avoids the US m/d/yyyy ambiguity).
 */
const SHORT_FMT: Record<Locale, Intl.DateTimeFormat> = {
  he: new Intl.DateTimeFormat('he-IL'),
  en: new Intl.DateTimeFormat('en-GB'),
};

export function formatDateShort(value: string | Date | null | undefined, locale: Locale): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return SHORT_FMT[locale].format(d);
}

/**
 * Numeric long date — day/numeric-month/numeric-year, no abbreviations.
 * Used for action-bar timestamps and other "stamped" UIs that should read
 * unambiguously even without context.
 */
const LONG_FMT: Record<Locale, Intl.DateTimeFormat> = {
  he: new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' }),
  en: new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'numeric', year: 'numeric' }),
};

export function formatDateLong(value: string | Date | null | undefined, locale: Locale): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return LONG_FMT[locale].format(d);
}
