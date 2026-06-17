'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { formatPersonName } from '@/lib/utils/person-name';

import type { TaskCommentAuthor, TaskCommentWithAuthor } from '../types';

// No PostgREST author embed. profiles RLS is self-or-admin (mig 011), so a
// non-admin viewer (an advisor) can't read a colleague's profile row — the
// embed returned author=null and `item.author.first_name` crashed the thread
// render. We select author_id and resolve display names server-side with the
// admin client below (names only), so every participant sees who wrote each row.
const COMMENT_COLUMNS = `
  id,
  task_id,
  author_id,
  body,
  event_type,
  metadata,
  created_at,
  edited_at,
  deleted_at
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

  const rows = data ?? [];

  // Resolve author names with the admin client (service role bypasses the
  // self-or-admin profiles RLS). Names only, and only for the author_ids that
  // appear in THIS thread. Mirrors notification-email's actor-name resolution.
  const authorIds = [...new Set(rows.map((row) => row.author_id))];
  const nameById = new Map<string, TaskCommentAuthor>();
  if (authorIds.length > 0) {
    const admin = createAdminClient();
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', authorIds);
    for (const p of profiles ?? []) {
      nameById.set(p.id, { id: p.id, first_name: p.first_name, last_name: p.last_name });
    }
  }

  const comments: TaskCommentWithAuthor[] = rows.map((row) => {
    const { author_id, ...rest } = row;
    return { ...rest, author: nameById.get(author_id) ?? null };
  });

  return { ok: true, comments };
}

type MentionableRow = { id: string; first_name: string | null; last_name: string | null };

/**
 * Teammates the caller may @-mention in THIS task's thread — only active users
 * who can actually VIEW the task (RPC list_task_mentionable_profiles, migration
 * 188, mirrors tasks_select), excluding the caller. Scoping the picker stops a
 * mention/notification from leaking the task to someone with no access (F11).
 */
export async function getTaskMentionableProfilesAction(taskId: string): Promise<
  { ok: true; members: Array<{ id: string; name: string }> } | { ok: false; error: 'unauthorized' }
> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // The RPC reads auth.uid() (caller context) + can_view_task, so it must run
  // on the user's session client, not the admin one.
  const { data, error } = await (supabase as unknown as {
    rpc(
      fn: 'list_task_mentionable_profiles',
      args: { p_task_id: string },
    ): PromiseLike<{ data: MentionableRow[] | null; error: { code?: string } | null }>;
  }).rpc('list_task_mentionable_profiles', { p_task_id: taskId });

  if (error) {
    console.error('[getTaskMentionableProfiles] rpc error', error.code);
    return { ok: true, members: [] }; // degrade to no suggestions, don't crash the thread
  }

  const members = (data ?? [])
    .map((p) => ({ id: p.id, name: formatPersonName(p.first_name, p.last_name) || '' }))
    .filter((m) => m.name.length > 0);

  return { ok: true, members };
}
