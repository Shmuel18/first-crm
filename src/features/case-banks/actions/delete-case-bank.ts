'use server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'unknown' };

export async function deleteCaseBankAction(
  caseBankId: string,
  caseId: string,
): Promise<Result> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // Defense-in-depth: caller must be able to edit the owning case.
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  // Soft-delete: hard DELETE is blocked by RLS (#37 hardening). Keeps history
  // for audit and lets retention purge clean it up later. Clear is_primary
  // on removal so a deleted row is never left flagged primary.
  const { data: deleted, error } = await supabase
    .from('case_banks')
    .update({
      deleted_at: new Date().toISOString(),
      is_primary: false,
      updated_by: userRes.user.id,
    })
    .eq('id', caseBankId)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .select('id');
  if (error) {
    console.error('[deleteCaseBank] db error', error);
    return { ok: false, error: 'unknown' };
  }
  if (!deleted || deleted.length === 0) return { ok: false, error: 'unauthorized' };

  // No revalidatePath — the inline banks list updates optimistically on the
  // client (case-banks-inline-list). See add-case-bank for the full rationale:
  // revalidating /cases/[id] re-rendered every block and lost scroll position.
  return { ok: true };
}
