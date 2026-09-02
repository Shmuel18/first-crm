import type { NotificationType } from '../types';

/**
 * Where a notification takes the reader — one rule shared by the bell, the
 * push payload and the email mirrors, which had each grown their own copy and
 * drifted (the email sent task_assigned to the CASE, which an advisor may not
 * be allowed to open).
 *
 * Task notifications never link to the case: the recipient can always see
 * their task, but the case may be hidden from them by RLS (advisors see only
 * cases they are assigned to), and that made the case page 404. They go to the
 * tasks page with `?thread=<taskId>`, which opens that task's conversation on
 * arrival — a mention lands the reader in the thread they were mentioned in,
 * not on the generic list. Without a task id (a legacy row from before the
 * column was populated) the bare list is the safe fallback.
 */
export function notificationHref(
  type: NotificationType,
  ids: { caseId: string | null; taskId: string | null },
): string {
  switch (type) {
    case 'web_lead':
      return '/cases?view=leads';
    case 'ai_digest':
      return '/cases';
    case 'backup_stale':
    case 'erasure_stale':
      return '/settings/integrations';
    case 'case_mention':
    case 'case_status_overdue':
      return ids.caseId ? `/cases/${ids.caseId}` : '/cases';
    case 'task_assigned':
    case 'task_completed':
    case 'task_reminder':
    case 'task_mention':
    case 'task_comment':
      return taskThreadHref(ids.taskId);
    default:
      return '/tasks';
  }
}

/** The tasks page, with the given task's conversation opened on arrival. */
export function taskThreadHref(taskId: string | null): string {
  return taskId ? `/tasks?thread=${encodeURIComponent(taskId)}` : '/tasks';
}
