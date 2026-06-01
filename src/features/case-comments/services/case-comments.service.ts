import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import type { CaseId } from '@/lib/types/branded';
import { formatPersonName } from '@/lib/utils/person-name';

import type { CaseCommentView } from '../types';

// Newest-first cap so the payload stays bounded on long-lived cases; the thread
// renders them oldest→newest. ~80 active cases in MVP, so 200 is generous.
const MAX_COMMENTS = 200;

type CommentJoinRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  author: { first_name: string | null; last_name: string | null } | null;
};

export async function listCaseComments(caseId: CaseId): Promise<CaseCommentView[]> {
  const supabase = await createClient();
  // `case_comments` (migration 107) isn't in the generated Database types until
  // they're regenerated post-migration — use an untyped handle and shape the
  // result through CommentJoinRow. Remove the cast after the next types gen.
  const db = supabase as unknown as SupabaseClient;

  const { data, error } = await db
    .from('case_comments')
    .select(
      'id, author_id, body, created_at, edited_at, author:profiles!case_comments_author_id_fkey(first_name, last_name)',
    )
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(MAX_COMMENTS);
  if (error) throw error;

  // PostgREST types a to-one embed as an array on the untyped client; at
  // runtime author_id→profiles is to-one (object|null). Cast through unknown,
  // same as incomes.service.
  const rows = (data ?? []) as unknown as CommentJoinRow[];
  // Reverse the newest-first fetch back to chronological order (oldest first).
  return rows
    .slice()
    .reverse()
    .map((r) => ({
      id: r.id,
      authorId: r.author_id,
      authorName: formatPersonName(r.author?.first_name, r.author?.last_name) || '—',
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

/** Active teammates available to @-mention in a comment (id + display name). */
export async function listMentionableProfiles(): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('is_active', true)
    .order('first_name');
  return (data ?? [])
    .map((p) => ({ id: p.id, name: formatPersonName(p.first_name, p.last_name) || '' }))
    .filter((m) => m.name.length > 0);
}
