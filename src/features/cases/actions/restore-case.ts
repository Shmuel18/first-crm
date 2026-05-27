'use server';

import { revalidatePath } from 'next/cache';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'not_found' | 'unknown' };

/**
 * Restore a soft-deleted case. Admin-only in the action and in the DB RPC.
 */
export async function restoreCaseAction(caseId: string): Promise<Result> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: updated, error } = await supabase.rpc('restore_case', {
    p_case_id: caseId,
  });

  if (error) {
    console.error('[restoreCase] db error', { caseId, code: error.code });
    return { ok: false, error: 'unknown' };
  }
  if (updated !== true) return { ok: false, error: 'not_found' };

  revalidatePath('/settings/recycle-bin');
  revalidatePath('/cases');
  return { ok: true };
}
