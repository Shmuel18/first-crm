import type { Locale } from '@/lib/i18n/direction';

/**
 * "2 hours ago" style label via the platform Intl API (no deps). Computed
 * against the current clock, so call from client render only and suppress
 * hydration warnings on the output (server prerender vs client differ by
 * seconds).
 */
export function formatRelativeTime(iso: string, locale: Locale): string {
  const rtf = new Intl.RelativeTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', {
    numeric: 'auto',
  });
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 30],
    ['month', 12],
  ];
  let value = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  for (const [unit, span] of steps) {
    if (Math.abs(value) < span) return rtf.format(value, unit);
    value = Math.round(value / span);
  }
  return rtf.format(value, 'year');
}
