'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';

import { EditCaseCommentSchema } from '../schemas/case-comment.schema';

type Result =
  | { ok: true; editedAt: string }
  | { ok: false; error: 'validation' | 'unauthorized' | 'unknown' };

/**
 * Edit one's own comment. The case_comments RLS allows UPDATE only for the
 * author, so the .select() row-count guard turns an RLS-denied edit (0 rows,
 * no error) into 'unauthorized'. No revalidatePath — the thread reconciles
 * optimistically (see post-case-comment for the rationale).
 */
export async function editCaseCommentAction(commentId: string, body: string): Promise<Result> {
  const parsed = EditCaseCommentSchema.safeParse({ commentId, body });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const editedAt = new Date().toISOString();
  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from('case_comments')
    .update({ body: parsed.data.body, edited_at: editedAt })
    .eq('id', parsed.data.commentId)
    .select('id');

  if (error) {
    console.error('[editCaseComment] update failed', error);
    return { ok: false, error: 'unknown' };
  }
  const rows = (data ?? []) as Array<{ id: string }>;
  if (rows.length === 0) return { ok: false, error: 'unauthorized' };

  return { ok: true, editedAt };
}
