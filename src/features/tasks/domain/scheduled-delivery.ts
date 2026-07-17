import { israelWallClockToIso } from '@/lib/utils/israel-time';

/** Grace window: a moment picked "now" in the picker shouldn't fail validation
 *  by the seconds it takes to submit. Anything older is a real past time. */
const PAST_GRACE_MS = 60_000;

export type ScheduledDelivery =
  | { ok: true; iso: string | null }
  | { ok: false; error: 'invalid' | 'past' };

/**
 * Resolve the "deliver this task at" picker value into the UTC instant stored
 * in tasks.snoozed_until, or null when the task is delivered immediately.
 *
 * The picker sends an Israel wall-clock string ("2026-07-19T08:00"): the office
 * means 08:00 in Israel regardless of where the server (UTC) or the advisor's
 * browser happens to be — see israelWallClockToIso.
 */
export function resolveScheduledDelivery(
  wallClock: string | null | undefined,
  now: Date = new Date(),
): ScheduledDelivery {
  if (!wallClock) return { ok: true, iso: null };
  const iso = israelWallClockToIso(wallClock);
  if (!iso) return { ok: false, error: 'invalid' };
  if (new Date(iso).getTime() < now.getTime() - PAST_GRACE_MS) {
    return { ok: false, error: 'past' };
  }
  return { ok: true, iso };
}

/**
 * Is this task parked for a future hand-off? Mirrors the SQL guard in
 * migration 218 — while true, the assignee must NOT be notified: the
 * task-reminders cron delivers the task (and its email) at the scheduled time.
 */
export function isScheduledDelivery(
  status: string | null | undefined,
  snoozedUntil: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (status !== 'snoozed' || !snoozedUntil) return false;
  const at = new Date(snoozedUntil).getTime();
  return !Number.isNaN(at) && at > now.getTime();
}
