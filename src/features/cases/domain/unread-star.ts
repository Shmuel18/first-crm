import { israelCivil, israelDayStartIso } from '@/lib/utils/israel-time';

/**
 * Manager "unread" star cadence (office_settings.unread_star_cadence).
 *   off    → feature disabled, no stars
 *   daily  → resets every Israel midnight
 *   weekly → resets on a chosen weekday's Israel midnight
 */
export type UnreadCadence = 'off' | 'daily' | 'weekly';

/** 0 = Sunday … 6 = Saturday (JS getDay convention, matches the DB CHECK). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * The UTC instant of the most recent reset, at-or-before `now`, in Israel civil
 * time. A case not opened since this instant shows the star. Returns null when
 * the feature is off (→ never unread). No cron: the boundary walks forward on
 * its own as the calendar advances.
 */
export function unreadResetBoundary(
  cadence: UnreadCadence,
  weekday: number,
  now: Date = new Date(),
): string | null {
  if (cadence === 'off') return null;

  const { year, month, day } = israelCivil(now);
  if (cadence === 'daily') return israelDayStartIso(year, month, day);

  // weekly: step back to the most recent occurrence of `weekday` (today counts).
  // getUTCDay on the bare civil date gives that date's weekday, TZ-independent.
  const civilWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysBack = (civilWeekday - weekday + 7) % 7;
  // Calendar subtraction via a UTC date used purely as a rollover-aware counter,
  // then resolve that civil date's Israel midnight (DST-safe).
  const target = new Date(Date.UTC(year, month - 1, day - daysBack));
  return israelDayStartIso(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    target.getUTCDate(),
  );
}

/**
 * Is the case unread? True when the manager never opened it, or last opened it
 * before the current reset boundary. A null boundary (feature off) is never
 * unread. Compared as instants so Postgres and JS ISO formats can't misorder.
 */
export function isCaseUnread(
  managerViewedAt: string | null,
  boundaryIso: string | null,
): boolean {
  if (boundaryIso === null) return false;
  if (managerViewedAt === null) return true;
  return new Date(managerViewedAt).getTime() < new Date(boundaryIso).getTime();
}
