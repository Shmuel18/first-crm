import { DEFAULT_STATISTICS_PERIOD, STATISTICS_PERIODS } from '../types';

import type { Locale } from '@/lib/i18n/direction';
import type { DateRange, StatisticsPeriod } from '../types';

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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function pickFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  // Round-trip guards against well-formatted-but-impossible dates (e.g. 13/40).
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Parse & validate a custom range from URL params. Returns null unless both
 * `from` and `to` are real YYYY-MM-DD dates with from <= to (lexical compare
 * is correct for zero-padded ISO dates).
 */
export function parseCustomRange(
  searchParams: Record<string, string | string[] | undefined>,
): DateRange | null {
  const from = pickFirst(searchParams.from);
  const to = pickFirst(searchParams.to);
  if (!from || !to || !isValidIsoDate(from) || !isValidIsoDate(to)) return null;
  if (from > to) return null;
  return { from, to };
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
