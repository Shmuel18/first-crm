import { DEFAULT_STATISTICS_PERIOD, STATISTICS_PERIODS } from '../types';

import type { Locale } from '@/lib/i18n/direction';
import type { StatisticsPeriod } from '../types';

/**
 * Narrow an untrusted URL search param to a known period preset, falling back
 * to the default. Pure — safe in both Server and Client Components.
 */
export function parseStatisticsPeriod(
  value: string | string[] | undefined,
): StatisticsPeriod {
  const raw = Array.isArray(value) ? value[0] : value;
  return (STATISTICS_PERIODS as readonly string[]).includes(raw ?? '')
    ? (raw as StatisticsPeriod)
    : DEFAULT_STATISTICS_PERIOD;
}

const MONTH_FMT: Record<Locale, Intl.DateTimeFormat> = {
  he: new Intl.DateTimeFormat('he-IL', { month: 'short', year: '2-digit' }),
  en: new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' }),
};

/** Format a "YYYY-MM" bucket key into a short localized month label. */
export function formatMonthLabel(monthKey: string, locale: Locale): string {
  const parts = monthKey.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return monthKey;
  }
  // UTC midday avoids any tz/DST rollover shifting the displayed month.
  return MONTH_FMT[locale].format(new Date(Date.UTC(year, month - 1, 1, 12)));
}
