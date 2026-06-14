'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';

import { sendTaskNotificationEmail } from '@/features/notifications/services/notification-email';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

import { emitTaskEvent } from '../lib/emit-task-event';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'validation' | 'unknown' };

const taskIdSchema = z.uuid();

export async function completeTaskAction(taskId: string): Promise<Result> {
  const idParsed = taskIdSchema.safeParse(taskId);
  if (!idParsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: existing } = await supabase
    .from('tasks')
    .select('id, case_id, status, title, description, assigned_by, created_by')
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
    console.error('[completeTask] db error', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  // Notify the latest assigner when someone else completes their task. Fall
  // back to the creator for legacy/unassigned rows.
  const completionRecipient = existing.assigned_by ?? existing.created_by;
  if (
    existing.status !== 'completed' &&
    completionRecipient &&
    completionRecipient !== userRes.user.id
  ) {
    // Best-effort email mirror, sent AFTER the response (Resend HTTP + DB hops
    // must not hold the button — see create-task). Bell is DB-trigger-driven.
    after(() =>
      sendTaskNotificationEmail({
        recipientId: completionRecipient,
        actorId: userRes.user.id,
        kind: 'task_completed',
        taskTitle: existing.title,
        caseId: existing.case_id,
        description: existing.description,
      }),
    );
  }

  await emitTaskEvent(supabase, {
    taskId: idParsed.data,
    authorId: userRes.user.id,
    eventType: 'completed',
    body: '✓ הושלמה',
  });

  // Completing the task clears the actor's own "assigned" alert for it, so the
  // bell stops showing it as unread (and stops the persistent red for a
  // critical one) the moment they handle it — not only when they open the bell.
  // Best-effort; own rows only (notifications RLS = user_id = auth.uid()).
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('task_id', idParsed.data)
    .eq('user_id', userRes.user.id)
    .is('read_at', null);

  revalidatePath('/tasks');
  if (existing.case_id) revalidatePath(`/cases/${existing.case_id}`);
  // Refresh the shell too so the sidebar task badge / critical dot clears now.
  revalidatePath('/(app)', 'layout');
  return { ok: true };
}
