/**
 * When does an assignee deserve the "update your tasks" nudge?
 * Pure domain logic — no I/O, no UI deps.
 *
 * A pending task is "awaiting an update" when:
 *  - it has a due date that already passed (the assignee should have completed
 *    or rescheduled it), OR
 *  - it has NO due date — the office's common case (Kaufman rarely sets one) —
 *    and nobody touched it for STALE_BUSINESS_HOURS, counted on Israeli
 *    business days only: Friday/Saturday hours don't count, so a task touched
 *    Thursday noon is nagged Sunday noon, not over the weekend. (updated_at is
 *    bumped by trg_tasks_updated_at on every edit.)
 * Snoozed tasks never count — parking a task IS an update.
 */

import { israelWeekday } from '@/lib/utils/israel-time';

export const STALE_BUSINESS_HOURS = 24;

const HOUR_MS = 3_600_000;
// A raw age no weekend can explain away — skip the hour-walk entirely.
const DEFINITELY_STALE_MS = 7 * 24 * HOUR_MS;
const FRIDAY = 5;
const SATURDAY = 6;

export type NudgeTaskFields = {
  status: string;
  due_date: string | null;
  updated_at: string;
};

/** Whole hours in (from, to] whose end falls on an Israeli business day
 *  (Sun–Thu). Capped at STALE_BUSINESS_HOURS — callers only compare. */
function elapsedBusinessHours(fromMs: number, toMs: number): number {
  if (toMs - fromMs >= DEFINITELY_STALE_MS) return STALE_BUSINESS_HOURS;
  let count = 0;
  for (let t = fromMs + HOUR_MS; t <= toMs; t += HOUR_MS) {
    const weekday = israelWeekday(new Date(t));
    if (weekday !== FRIDAY && weekday !== SATURDAY) count++;
    if (count >= STALE_BUSINESS_HOURS) break;
  }
  return count;
}

export function isTaskAwaitingUpdate(task: NudgeTaskFields, now: Date = new Date()): boolean {
  if (task.status !== 'pending') return false;
  if (task.due_date) return new Date(task.due_date).getTime() < now.getTime();
  const updatedAt = new Date(task.updated_at).getTime();
  if (!Number.isFinite(updatedAt)) return false;
  return elapsedBusinessHours(updatedAt, now.getTime()) >= STALE_BUSINESS_HOURS;
}

export function countTasksAwaitingUpdate(
  tasks: ReadonlyArray<NudgeTaskFields>,
  now: Date = new Date(),
): number {
  return tasks.filter((t) => isTaskAwaitingUpdate(t, now)).length;
}
