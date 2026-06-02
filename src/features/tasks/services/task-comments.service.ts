'use server';

import { createClient } from '@/lib/supabase/server';

import type { TaskCommentWithAuthor } from '../types';

const COMMENT_COLUMNS = `
  id,
  task_id,
  body,
  event_type,
  metadata,
  created_at,
  edited_at,
  deleted_at,
  author:profiles!task_comments_author_id_fkey (
    id,
    first_name,
    last_name
  )
` as const;

/**
 * Fetch all visible thread rows for a task, oldest-first.
 * Used as a server action so client components (the thread dialog) can call it
 * directly with useTransition — no API route needed.
 */
export async function getTaskCommentsAction(
  taskId: string,
): Promise<
  { ok: true; comments: TaskCommentWithAuthor[] } | { ok: false; error: 'unauthorized' | 'unknown' }
> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data, error } = await supabase
    .from('task_comments')
    .select(COMMENT_COLUMNS)
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[getTaskComments] db error', error.code);
    return { ok: false, error: 'unknown' };
  }

  // The Supabase join returns author as an object (single row) — narrow the type.
  const comments = (data ?? []).map((row) => ({
    ...row,
    author: Array.isArray(row.author) ? row.author[0] : row.author,
  })) as TaskCommentWithAuthor[];

  return { ok: true, comments };
}
