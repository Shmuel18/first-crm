import type { Locale } from '@/lib/i18n/direction';

const DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

// Cached at module level — constructing per call (once per notification row)
// is wasteful.
const RTF: Record<'he' | 'en', Intl.RelativeTimeFormat> = {
  he: new Intl.RelativeTimeFormat('he-IL', { numeric: 'auto' }),
  en: new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' }),
};

export function formatRelativeTime(iso: string, locale: Locale): string {
  const rtf = RTF[locale === 'he' ? 'he' : 'en'];
  let duration = (new Date(iso).getTime() - Date.now()) / 1000;

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return '';
}
