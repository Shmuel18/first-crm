import { after } from 'next/server';

import { sendTaskNotificationEmail } from '@/features/notifications/services/notification-email';

type Input = {
  recipientId: string;
  actorId: string;
  taskTitle: string;
  caseId: string | null;
};

/**
 * Best-effort "a task was assigned to you" email, shared by create/update-task.
 *
 * Runs AFTER the response so the submit button releases the moment the task is
 * saved — the email does ~4 DB hops + a Resend HTTP call (10s timeout), and
 * blocking the action on it made the button spin for seconds (R4 perf). The
 * in-app bell is written by a DB trigger, so the recipient is notified
 * instantly regardless.
 *
 * Callers must skip this for a SCHEDULED task (mig 218): its whole point is to
 * reach the assignee at the scheduled time, which the task-reminders cron does
 * via the email-mirrored task_reminder (mig 161).
 */
export function emailAssignedTask({ recipientId, actorId, taskTitle, caseId }: Input): void {
  after(() =>
    sendTaskNotificationEmail({ recipientId, actorId, kind: 'task_assigned', taskTitle, caseId }),
  );
}
