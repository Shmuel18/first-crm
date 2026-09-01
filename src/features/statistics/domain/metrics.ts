import type { Locale } from '@/lib/i18n/direction';
import type {
  CycleBucket,
  MonthlyTrend,
  StageBreakdownRow,
  StatusSnapshot,
} from '../schemas/statistics.schema';

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

/** A bucket ready to render: its share of the population and its bar length. */
export type CycleBucketView = CycleBucket & { share: number; barPct: number };

/**
 * Prepare the cycle-time histogram. `share` is the bucket's percentage of all
 * measured cases (what the reader wants to know); `barPct` scales against the
 * BIGGEST bucket, not the total, so the tallest bar always fills the track and
 * a flat distribution stays legible instead of rendering five stubs.
 */
export function toCycleBucketViews(buckets: CycleBucket[], total: number): CycleBucketView[] {
  const max = buckets.reduce((m, b) => Math.max(m, b.count), 0);
  return buckets.map((b) => ({
    ...b,
    share: total > 0 ? Math.round((b.count / total) * 100) : 0,
    barPct: max > 0 ? (b.count / max) * 100 : 0,
  }));
}

/** A stage row ready to render, with its bar scaled to the slowest stage. */
export type StageBreakdownView = StageBreakdownRow & { barPct: number };

/** Slowest stage first — "where do cases actually sit" is the question. */
export function toStageBreakdownViews(rows: StageBreakdownRow[]): StageBreakdownView[] {
  const max = rows.reduce((m, r) => Math.max(m, r.avg_days), 0);
  return [...rows]
    .sort((a, b) => b.avg_days - a.avg_days)
    .map((r) => ({ ...r, barPct: max > 0 ? (r.avg_days / max) * 100 : 0 }));
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
