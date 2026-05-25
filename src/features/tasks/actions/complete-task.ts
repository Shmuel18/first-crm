'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { sendTaskNotificationEmail } from '@/features/notifications/services/notification-email';
import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'validation' | 'unknown'; message?: string };

const taskIdSchema = z.uuid();

export async function completeTaskAction(taskId: string): Promise<Result> {
  const idParsed = taskIdSchema.safeParse(taskId);
  if (!idParsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: existing } = await supabase
    .from('tasks')
    .select('id, case_id, status, title, created_by')
    .eq('id', idParsed.data)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return { ok: false, error: 'not_found' };

  // .select() confirms the row was actually updated. tasks_select is broader
  // than tasks_update (view_all_cases can see tasks they can't modify), so an
  // RLS-denied UPDATE affects 0 rows with no error — surface that as a failure.
  const { data: updated, error } = await supabase
    .from('tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: userRes.user.id,
      updated_by: userRes.user.id,
    })
    .eq('id', idParsed.data)
    .select('id');

  if (error) {
    console.error('[completeTask] db error', error);
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  // Notify the creator when someone else completes their task (skip if it was
  // already completed, to avoid re-sending on a redundant click).
  if (
    existing.status !== 'completed' &&
    existing.created_by &&
    existing.created_by !== userRes.user.id
  ) {
    await sendTaskNotificationEmail({
      recipientId: existing.created_by,
      actorId: userRes.user.id,
      kind: 'task_completed',
      taskTitle: existing.title,
      caseId: existing.case_id,
    });
  }

  revalidatePath('/tasks');
  if (existing.case_id) revalidatePath(`/cases/${existing.case_id}`);
  return { ok: true };
}

export async function reopenTaskAction(taskId: string): Promise<Result> {
  const idParsed = taskIdSchema.safeParse(taskId);
  if (!idParsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: existing } = await supabase
    .from('tasks')
    .select('id, case_id')
    .eq('id', idParsed.data)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return { ok: false, error: 'not_found' };

  const { data: updated, error } = await supabase
    .from('tasks')
    .update({
      status: 'pending',
      completed_at: null,
      completed_by: null,
      updated_by: userRes.user.id,
    })
    .eq('id', idParsed.data)
    .select('id');

  if (error) {
    console.error('[reopenTask] db error', error);
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  revalidatePath('/tasks');
  if (existing.case_id) revalidatePath(`/cases/${existing.case_id}`);
  return { ok: true };
}
