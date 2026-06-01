'use server';

import { revalidatePath } from 'next/cache';

import { sendTaskNotificationEmail } from '@/features/notifications/services/notification-email';
import { createClient } from '@/lib/supabase/server';

import { ReassignTaskSchema } from '../schemas/task.schema';
import type { TaskUpdate } from '../types';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'validation' | 'unknown' };

/**
 * Hand a task to another active teammate. Permission rides on the existing
 * tasks RLS + guard trigger (029): whoever may edit a task may reassign it, and
 * the DB rejects an inactive/unknown assignee. Private tasks are reminders bound
 * to their creator — the UI hides this action for them and the
 * tasks_private_self_assigned CHECK blocks a cross-user reassignment, so we
 * don't special-case it here. The in-app bell notification to the new assignee
 * fires automatically via the notify_task_change trigger (028/089).
 */
export async function reassignTaskAction(taskId: string, assigneeId: string): Promise<Result> {
  const parsed = ReassignTaskSchema.safeParse({ taskId, assigneeId });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  const userId = userRes.user.id;

  const { data: existing } = await supabase
    .from('tasks')
    .select('id, case_id, assigned_to, title')
    .eq('id', parsed.data.taskId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return { ok: false, error: 'not_found' };

  // Already assigned to the target → nothing to do.
  if (existing.assigned_to === parsed.data.assigneeId) return { ok: true };

  // .select() row-count guard: tasks_select is broader than tasks_update, so an
  // RLS-denied UPDATE affects 0 rows with no error — treat that as unauthorized.
  const patch: TaskUpdate = { assigned_to: parsed.data.assigneeId, updated_by: userId };
  const { data: updated, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', parsed.data.taskId)
    .select('id');
  if (error) {
    console.error('[reassignTask] db error', error);
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  // Best-effort email mirror (never throws), matching create/update-task.
  await sendTaskNotificationEmail({
    recipientId: parsed.data.assigneeId,
    actorId: userId,
    kind: 'task_assigned',
    taskTitle: existing.title,
    caseId: existing.case_id,
  });

  revalidatePath('/tasks');
  if (existing.case_id) revalidatePath(`/cases/${existing.case_id}`);
  revalidatePath('/(app)', 'layout');
  return { ok: true };
}
