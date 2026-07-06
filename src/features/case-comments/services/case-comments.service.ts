import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import type { CaseId } from '@/lib/types/branded';
import { formatPersonName } from '@/lib/utils/person-name';

import type { CaseCommentView } from '../types';

// Newest-first cap so the payload stays bounded on long-lived cases; the thread
// renders them oldest→newest. ~80 active cases in MVP, so 200 is generous.
const MAX_COMMENTS = 200;

type CommentRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
};

/**
 * author_id → display name for a case's comment authors. The `profiles` table is
 * self-or-admin (mig 145 — it holds the calendar token, must not be broadened),
 * so a non-admin embedding profiles gets NULL for everyone else's name (the whole
 * thread would show "—"). This SECURITY DEFINER RPC (mig 217) exposes ONLY the
 * first/last name of authors on a case the caller may view.
 */
async function resolveAuthorNames(db: SupabaseClient, caseId: CaseId): Promise<Map<string, string>> {
  const { data, error } = await (
    db as unknown as {
      rpc(
        fn: 'list_case_comment_authors',
        args: { p_case_id: string },
      ): PromiseLike<{
        data: Array<{ id: string; first_name: string | null; last_name: string | null }> | null;
        error: { code?: string } | null;
      }>;
    }
  ).rpc('list_case_comment_authors', { p_case_id: caseId });
  if (error) {
    console.error('[listCaseComments] author-name rpc error', error.code);
    return new Map();
  }
  const map = new Map<string, string>();
  for (const p of data ?? []) {
    const name = formatPersonName(p.first_name, p.last_name);
    if (name) map.set(p.id, name);
  }
  return map;
}

export async function listCaseComments(caseId: CaseId): Promise<CaseCommentView[]> {
  const supabase = await createClient();
  // `case_comments` (migration 107) isn't in the generated Database types until
  // they're regenerated post-migration — use an untyped handle and shape the
  // result through CommentRow. Remove the cast after the next types gen.
  const db = supabase as unknown as SupabaseClient;

  const { data, error } = await db
    .from('case_comments')
    .select('id, author_id, body, created_at, edited_at')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(MAX_COMMENTS);
  if (error) throw error;

  const rows = (data ?? []) as unknown as CommentRow[];
  const names = await resolveAuthorNames(db, caseId);

  // Reverse the newest-first fetch back to chronological order (oldest first).
  return rows
    .slice()
    .reverse()
    .map((r) => ({
      id: r.id,
      authorId: r.author_id,
      authorName: names.get(r.author_id) || '—',
      body: r.body,
      createdAt: r.created_at,
      editedAt: r.edited_at,
    }));
}

/** Display name of one profile — used to label the current user's optimistic
 *  bubbles before the row round-trips back from the server. */
export async function getCommenterName(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', userId)
    .maybeSingle();
  return formatPersonName(data?.first_name, data?.last_name) || null;
}

/**
 * Teammates the caller may @-mention in THIS case's thread — only active users
 * who can actually VIEW the case (RPC list_case_mentionable_profiles, migration
 * 194, mirrors can_view_case), excluding the caller. Scoping the picker stops a
 * mention/notification from leaking a comment preview to someone with no access
 * to the case (CC-1 / NOTIF-1).
 */
export async function listMentionableProfiles(
  caseId: string,
): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createClient();
  // The RPC reads auth.uid() (caller context) + can_view_case, so it must run on
  // the user's session client (createClient), not the admin one.
  const { data, error } = await (
    supabase as unknown as {
      rpc(
        fn: 'list_case_mentionable_profiles',
        args: { p_case_id: string },
      ): PromiseLike<{
        data: Array<{ id: string; first_name: string | null; last_name: string | null }> | null;
        error: { code?: string } | null;
      }>;
    }
  ).rpc('list_case_mentionable_profiles', { p_case_id: caseId });
  if (error) {
    console.error('[listMentionableProfiles] rpc error', error.code);
    return []; // degrade to no suggestions, don't crash the thread
  }
  return (data ?? [])
    .map((p) => ({ id: p.id, name: formatPersonName(p.first_name, p.last_name) || '' }))
    .filter((m) => m.name.length > 0);
}
