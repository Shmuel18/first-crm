/**
 * Case cycle time — "כמה זמן לקח מפתיחת התיק ועד ביצוע".
 *
 * The milestone is the first time a case reached ביצוע *or* בוצע ושולם
 * ('execution' / 'closed'); a case can jump straight to the latter, and both
 * mean the deal happened. The opening anchor is cases.opened_at when the
 * office filled it in, else cases.created_at — imported cases carry the
 * import date in created_at, which is why opened_at exists (migration 243).
 *
 * Kept pure so the same rules can be unit-tested without a database. The SQL
 * side of this lives in get_statistics_summary (same migration) and resolves
 * opened_at at Israel-local midnight; here it parses as UTC midnight. The
 * gap is at most three hours and both sides round to whole days, so the two
 * surfaces only ever disagree when the true value sits within three hours of
 * a half-day boundary — not worth a timezone dependency in the client bundle.
 */

const MS_PER_DAY = 86_400_000;

/** One row of a case's status history, as stage_durations records it. */
export type StageVisit = { entered_at: string; status_id: string };

/**
 * When the case's CURRENT run at ביצוע / בוצע ושולם began, or null if it is
 * not at either right now (migration 244).
 *
 * ביצוע is a state, not a permanent achievement: a case enters when the status
 * is set and leaves when it is set back. Without this, a status picked by
 * mistake and undone moments later stuck forever — case 2026-003 reported
 * "הגיע לביצוע" off a 42-second slip.
 *
 * Walking back from the newest row rather than taking the earliest milestone
 * matters: a case that slipped once and later reached ביצוע for real must
 * report the REAL date, not the slip.
 *
 * Must stay in step with the `milestone` CTE in migration 244.
 */
export function currentMilestoneStart(
  visits: StageVisit[],
  milestoneStatusIds: readonly string[],
): string | null {
  const ordered = [...visits].sort((a, b) => a.entered_at.localeCompare(b.entered_at));
  let start: string | null = null;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const visit = ordered[i];
    if (visit === undefined || !milestoneStatusIds.includes(visit.status_id)) break;
    start = visit.entered_at;
  }
  return start;
}

/** Effective opening instant: the hand-entered date wins over the row's. */
export function resolveOpenedAt(openedAt: string | null, createdAt: string): string {
  return openedAt ?? createdAt;
}

/**
 * Whole days between two instants, rounded. Negative when the milestone
 * predates the opening date (a typo in opened_at) — the caller decides
 * whether to show that or fall back; we do not silently clamp it to 0,
 * because a negative number is the only visible signal that the date is wrong.
 */
export function daysBetween(from: string, to: string): number | null {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / MS_PER_DAY);
}

export type CaseCycleTime =
  /** Reached ביצוע — `days` is opening → milestone. */
  | { state: 'reached'; days: number; reachedAt: string }
  /** Still in flight — `days` is opening → today. */
  | { state: 'pending'; days: number };

/**
 * The case's cycle time as the מנהלה block renders it. `now` is injected so
 * the value is deterministic in tests and stable within one server render.
 */
export function computeCaseCycleTime(
  openedAt: string | null,
  createdAt: string,
  reachedAt: string | null,
  now: string,
): CaseCycleTime | null {
  const start = resolveOpenedAt(openedAt, createdAt);
  if (reachedAt !== null) {
    const days = daysBetween(start, reachedAt);
    return days === null ? null : { state: 'reached', days, reachedAt };
  }
  const days = daysBetween(start, now);
  return days === null ? null : { state: 'pending', days };
}
