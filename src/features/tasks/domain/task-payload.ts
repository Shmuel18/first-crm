import type { TaskFormInput } from '../schemas/task.schema';
import type { TaskInsert } from '../types';

/** i18n key for a rejected "deliver at" value. */
export function scheduleErrorKey(error: 'invalid' | 'past'): string {
  return error === 'past' ? 'common.errors.dateInFuture' : 'common.errors.invalidDate';
}

/**
 * The tasks row for a newly created task.
 *
 * Two non-obvious rules:
 *  - A private task is a reminder to oneself — force self-assignment so it
 *    satisfies the tasks_private_self_assigned CHECK and stays invisible to
 *    others.
 *  - A scheduled task is parked in `snoozed` until its instant; the
 *    task-reminders cron flips it to pending and fires the task_reminder bell
 *    + email THEN — that cron IS the delivery (see migration 218).
 *
 * `is_private` / `snoozed_until` (migrations 098) aren't in the generated types
 * yet, so the row is cast to TaskInsert — the values are still sent at runtime.
 */
export function buildTaskInsertPayload(
  input: TaskFormInput,
  userId: string,
  scheduledIso: string | null,
): TaskInsert {
  const isPrivate = input.is_private;
  return {
    title: input.title,
    description: input.description ?? null,
    priority: input.priority ?? 'normal',
    assigned_to: isPrivate ? userId : input.assigned_to ?? null,
    case_id: input.case_id ?? null,
    due_date: input.due_date ?? null,
    is_private: isPrivate,
    ...(scheduledIso ? { status: 'snoozed', snoozed_until: scheduledIso } : {}),
    created_by: userId,
    updated_by: userId,
  } as TaskInsert;
}
