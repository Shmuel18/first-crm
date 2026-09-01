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
