import type { Locale } from '@/lib/i18n/direction';
import type { MonthlyTrend, StatusSnapshot } from '../schemas/statistics.schema';

/**
 * Statuses surfaced as count chips beside the funnel instead of bars: the two
 * paused states, plus the terminal 'closed' — its count is an ever-growing
 * all-time total (archived cases included since migration 226) that would
 * dwarf the live pipeline bars. Everything else — including admin-created
 * stages — is a pipeline bar, ordered by sort_order.
 */
const SIDE_KEYS = ['closed', 'stuck', 'on_hold'] as const;

export type StatusDirection = 'up' | 'down' | 'flat';
export type Delta = { pct: number | null; direction: StatusDirection };

/**
 * Percentage change of `current` vs `previous`.
 * - previous 0 → pct null (can't divide), direction by sign of current.
 * - equal → flat.
 */
export function computeDelta(current: number, previous: number): Delta {
  if (current === previous) return { pct: 0, direction: 'flat' };
  if (previous === 0) return { pct: null, direction: current > 0 ? 'up' : 'down' };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { pct, direction: pct >= 0 ? 'up' : 'down' };
}

/** Split a status snapshot into the linear pipeline and the off-flow states. */
export function splitPipeline(snapshot: StatusSnapshot[]): {
  pipeline: StatusSnapshot[];
  side: StatusSnapshot[];
} {
  const ordered = [...snapshot].sort((a, b) => a.sort_order - b.sort_order);
  const isSide = (key: string): boolean => (SIDE_KEYS as readonly string[]).includes(key);
  return {
    pipeline: ordered.filter((s) => !isSide(s.key)),
    side: ordered.filter((s) => isSide(s.key)),
  };
}

export function statusName(
  status: { name_he: string; name_en: string },
  locale: Locale,
): string {
  return locale === 'he' ? status.name_he : status.name_en;
}

/** Last two months of the trend, for a this-month vs last-month delta. */
export function lastTwoMonths(trend: MonthlyTrend): {
  current: MonthlyTrend[number] | null;
  previous: MonthlyTrend[number] | null;
} {
  return {
    current: trend.length > 0 ? trend[trend.length - 1] ?? null : null,
    previous: trend.length > 1 ? trend[trend.length - 2] ?? null : null,
  };
}
