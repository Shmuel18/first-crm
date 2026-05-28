'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { sendTaskNotificationEmail } from '@/features/notifications/services/notification-email';
import { createClient } from '@/lib/supabase/server';

import { TASK_STATUS_VALUES, type TaskUpdate } from '../types';

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
    .select('id, case_id, status, title, created_by')
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
    console.error('[changeTaskStatus] db error', error);
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  if (
    newStatus === 'completed' &&
    existing.status !== 'completed' &&
    existing.created_by &&
    existing.created_by !== userId
  ) {
    // Best-effort: the status change already committed, so a notification
    // failure must not surface as a failed action (which would prompt a retry).
    try {
      await sendTaskNotificationEmail({
        recipientId: existing.created_by,
        actorId: userId,
        kind: 'task_completed',
        taskTitle: existing.title,
        caseId: existing.case_id,
      });
    } catch (err) {
      console.error('task-completed notification failed', err);
    }
  }

  revalidatePath('/tasks');
  if (existing.case_id) revalidatePath(`/cases/${existing.case_id}`);
  revalidatePath('/', 'layout');
  return { ok: true };
}
