/**
 * When does an assignee deserve the "update your tasks" nudge?
 * Pure domain logic — no I/O, no UI deps.
 *
 * A pending task is "awaiting an update" when:
 *  - it has a due date that already passed (the assignee should have completed
 *    or rescheduled it), OR
 *  - it has NO due date and nobody touched it for STALE_NO_DUE_DATE_DAYS
 *    (updated_at is bumped by trg_tasks_updated_at on every edit).
 * Snoozed tasks never count — parking a task IS an update.
 */

export const STALE_NO_DUE_DATE_DAYS = 7;

const DAY_MS = 86_400_000;

export type NudgeTaskFields = {
  status: string;
  due_date: string | null;
  updated_at: string;
};

export function isTaskAwaitingUpdate(task: NudgeTaskFields, now: Date = new Date()): boolean {
  if (task.status !== 'pending') return false;
  if (task.due_date) return new Date(task.due_date).getTime() < now.getTime();
  const updatedAt = new Date(task.updated_at).getTime();
  if (!Number.isFinite(updatedAt)) return false;
  return now.getTime() - updatedAt >= STALE_NO_DUE_DATE_DAYS * DAY_MS;
}

export function countTasksAwaitingUpdate(
  tasks: ReadonlyArray<NudgeTaskFields>,
  now: Date = new Date(),
): number {
  return tasks.filter((t) => isTaskAwaitingUpdate(t, now)).length;
}
