'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { sendTaskNotificationEmail } from '@/features/notifications/services/notification-email';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

import { emitTaskEvent } from '../lib/emit-task-event';
import { TASK_STATUS_VALUES, type TaskUpdate } from '../types';

const STATUS_LABEL: Record<string, string> = {
  pending: 'פתוחה',
  in_progress: 'בעבודה',
  completed: 'הושלמה',
  snoozed: 'מושהית',
  cancelled: 'בוטלה',
};

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'validation' | 'unknown'; message?: string };

const schema = z.object({
  taskId: z.uuid(),
  status: z.enum(TASK_STATUS_VALUES),
});

export async function changeTaskStatusAction(taskId: string, status: string): Promise<Result> {
  const parsed = schema.safeParse({ taskId, status });
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { status: newStatus } = parsed.data;

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  const userId = userRes.user.id;

  const { data: existing } = await supabase
    .from('tasks')
    .select('id, case_id, status, title, assigned_by, created_by')
    .eq('id', parsed.data.taskId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return { ok: false, error: 'not_found' };
  if (existing.status === newStatus) return { ok: true };

  const patch: TaskUpdate = { status: newStatus, updated_by: userId };
  if (newStatus === 'completed') {
    patch.completed_at = new Date().toISOString();
    patch.completed_by = userId;
  } else {
    // Leaving completed (or any other move): clear the completion stamps.
    patch.completed_at = null;
    patch.completed_by = null;
  }

  // .select() row-count guard: tasks_select is broader than tasks_update, so an
  // RLS-denied UPDATE affects 0 rows with no error — treat that as unauthorized.
  const { data: updated, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', parsed.data.taskId)
    .select('id');
  if (error) {
    console.error('[changeTaskStatus] db error', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  const completionRecipient = existing.assigned_by ?? existing.created_by;
  if (
    newStatus === 'completed' &&
    existing.status !== 'completed' &&
    completionRecipient &&
    completionRecipient !== userId
  ) {
    // Best-effort: the status change already committed, so a notification
    // failure must not surface as a failed action (which would prompt a retry).
    try {
      await sendTaskNotificationEmail({
        recipientId: completionRecipient,
        actorId: userId,
        kind: 'task_completed',
        taskTitle: existing.title,
        caseId: existing.case_id,
      });
    } catch (err) {
      console.error('task-completed notification failed', err);
    }
  }

  await emitTaskEvent(supabase, {
    taskId: parsed.data.taskId,
    authorId: userId,
    eventType: 'status_changed',
    body: `שונה סטטוס ל«${STATUS_LABEL[newStatus] ?? newStatus}»`,
    metadata: { old_status: existing.status, new_status: newStatus },
  });

  // Resolving the task (done/cancelled) clears the actor's own "assigned" alert
  // for it — so the bell stops showing it as unread (and drops the persistent
  // red for a critical one) the moment they handle it. Best-effort; own rows
  // only (notifications RLS = user_id = auth.uid()).
  if (newStatus === 'completed' || newStatus === 'cancelled') {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('task_id', parsed.data.taskId)
      .eq('user_id', userId)
      .is('read_at', null);
  }

  revalidatePath('/tasks');
  if (existing.case_id) revalidatePath(`/cases/${existing.case_id}`);
  // Refresh the shell too so the sidebar task badge / critical dot reflects the
  // new status now (not only on the next navigation).
  revalidatePath('/(app)', 'layout');
  return { ok: true };
}
