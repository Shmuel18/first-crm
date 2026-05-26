'use server';

import { revalidatePath } from 'next/cache';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'not_found' | 'unknown' };

/**
 * Restore a soft-deleted case (clears `deleted_at`). Admin-only — the
 * recycle-bin page that calls this is admin-only too, but the action
 * re-checks defensively because server actions are addressable URLs.
 *
 * The `audit_log` trigger logs the transition deleted_at→NULL as a
 * `RESTORE` action automatically (migration 012). The `.not('deleted_at', 'is', null)`
 * filter guards against double-restore from a stale UI: if the row's
 * already alive, we return `not_found` and the page re-fetches.
 */
export async function restoreCaseAction(caseId: string): Promise<Result> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // Service-role UPDATE — see deleteCaseAction's note. RLS rejects the
  // deleted_at transition for advisor-scoped policies, even for admins who
  // have all relevant permissions.
  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from('cases')
    .update({ deleted_at: null, updated_by: userRes.user.id })
    .eq('id', caseId)
    .not('deleted_at', 'is', null)
    .select('id');

  if (error) {
    console.error('[restoreCase] db error', { caseId, code: error.code });
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'not_found' };

  revalidatePath('/settings/recycle-bin');
  revalidatePath('/cases');
  return { ok: true };
}
