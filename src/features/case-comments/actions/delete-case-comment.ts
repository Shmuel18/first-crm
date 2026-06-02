'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'validation' | 'unauthorized' | 'unknown' };

const idSchema = z.uuid({ error: 'common.errors.invalidUuid' });

/**
 * Delete a comment — physically (no soft-delete, by spec: a removed comment
 * leaves no trace). The case_comments RLS allows DELETE for the author OR a
 * manager (is_admin), so the .select() row-count guard maps an RLS-denied
 * delete to 'unauthorized'. No revalidatePath — the thread removes it
 * optimistically.
 */
export async function deleteCaseCommentAction(commentId: string): Promise<Result> {
  const parsed = idSchema.safeParse(commentId);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from('case_comments')
    .delete()
    .eq('id', parsed.data)
    .select('id');

  if (error) {
    console.error('[deleteCaseComment] delete failed', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }
  const rows = (data ?? []) as Array<{ id: string }>;
  if (rows.length === 0) return { ok: false, error: 'unauthorized' };

  return { ok: true };
}
