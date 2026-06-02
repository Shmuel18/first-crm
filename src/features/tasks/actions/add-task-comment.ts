'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

import { AddTaskCommentSchema } from '../schemas/task.schema';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'validation' | 'unknown' };

/**
 * Add a free-text comment to a task's thread.
 * The comment is always associated with the authenticated user (author_id = uid).
 */
export async function addTaskCommentAction(taskId: string, body: string): Promise<Result> {
  const parsed = AddTaskCommentSchema.safeParse({ taskId, body });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  const userId = userRes.user.id;

  // Verify the task exists and is accessible to this user.
  const { data: task } = await supabase
    .from('tasks')
    .select('id, case_id')
    .eq('id', parsed.data.taskId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!task) return { ok: false, error: 'not_found' };

  const { error } = await supabase.from('task_comments').insert({
    task_id: parsed.data.taskId,
    author_id: userId,
    body: parsed.data.body,
    event_type: 'comment',
  });

  if (error) {
    console.error('[addTaskComment] db error', error.code);
    return { ok: false, error: 'unknown' };
  }

  revalidatePath('/tasks');
  if (task.case_id) revalidatePath(`/cases/${task.case_id}`);
  return { ok: true };
}
