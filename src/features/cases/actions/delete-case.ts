'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'unknown' };

/**
 * Soft-delete a case. The action checks permissions for fast feedback; the
 * database re-checks the same lifecycle rule in soft_delete_case.
 */
export async function deleteCaseAction(caseId: string): Promise<Result> {
  const supabase = await createClient();

  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('delete_case'))) {
    return { ok: false, error: 'unauthorized' };
  }

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: updated, error } = await supabase.rpc('soft_delete_case', {
    p_case_id: caseId,
  });

  if (error) {
    console.error('[deleteCase] db error', {
      caseId,
      code: error.code,
      message: error.message,
    });
    return { ok: false, error: 'unknown' };
  }
  if (updated !== true) return { ok: false, error: 'unauthorized' };

  revalidatePath('/cases');
  return { ok: true };
}
