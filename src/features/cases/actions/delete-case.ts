'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'unknown' };

/**
 * Soft-delete a case. Stamps deleted_at; the row stays in the DB until the
 * retention sweep (cleanup_soft_deleted_records, migration 022) hard-deletes
 * it. Within the retention window, /settings/recycle-bin lets admins restore
 * via restoreCaseAction.
 *
 * Permission gating happens entirely in this action — userCanEditCase +
 * userHasPermission('delete_case') — and the actual UPDATE runs via the
 * service-role client. RLS on cases_update (migration 011) rejects the
 * deleted_at transition for non-trivial roles (the policy doesn't model
 * the "soft-delete" write specifically), so going through admin keeps the
 * UX working while we model the gating at the app layer. Same pattern as
 * the SLA cron + restoreCaseAction + permanentDeleteCaseAction.
 */
export async function deleteCaseAction(caseId: string): Promise<Result> {
  const supabase = await createClient();

  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('delete_case'))) {
    return { ok: false, error: 'unauthorized' };
  }

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from('cases')
    .update({ deleted_at: new Date().toISOString(), updated_by: userRes.user.id })
    .eq('id', caseId)
    .is('deleted_at', null)
    .select('id');

  if (error) {
    console.error('[deleteCase] db error', {
      caseId,
      code: error.code,
      message: error.message,
    });
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  revalidatePath('/cases');
  return { ok: true };
}
