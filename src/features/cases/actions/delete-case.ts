'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'unknown' };

/**
 * Soft-delete a case. Stamps deleted_at; the row stays in the DB until the
 * retention sweep (cleanup_soft_deleted_records, migration 022) hard-deletes
 * it. Restore within the retention window is currently a manual SQL job —
 * matches the existing soft-delete semantics on documents/borrowers.
 *
 * Permission: requires both delete_case (sensitive action) AND edit-rights
 * on this specific case. RLS catches it too, but the explicit check fails
 * fast with a cleaner error than waiting for the UPDATE to affect 0 rows.
 */
export async function deleteCaseAction(caseId: string): Promise<Result> {
  const supabase = await createClient();

  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('delete_case'))) {
    return { ok: false, error: 'unauthorized' };
  }

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: updated, error } = await supabase
    .from('cases')
    .update({ deleted_at: new Date().toISOString(), updated_by: userRes.user.id })
    .eq('id', caseId)
    .is('deleted_at', null)
    .select('id');

  if (error) {
    console.error('[deleteCase] db error', { caseId, code: error.code });
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  revalidatePath('/cases');
  return { ok: true };
}
