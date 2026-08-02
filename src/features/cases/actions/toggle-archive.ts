'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type CasesUpdate = Database['public']['Tables']['cases']['Update'];

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'unknown'; message?: string };

export async function toggleArchiveAction(
  caseId: string,
  archive: boolean,
): Promise<Result> {
  const supabase = await createClient();

  // Archiving and un-archiving are separate permissions per spec 3.6.5, and
  // the caller must also be able to edit the case (not merely see it).
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };
  const permKey = archive ? 'archive_case' : 'restore_archived_case';
  const { data: hasPerm } = await supabase.rpc('has_permission', {
    perm_key: permKey,
  });
  if (hasPerm !== true) return { ok: false, error: 'unauthorized' };

  const payload: CasesUpdate = { is_archived: archive };
  if (!archive) {
    // Restoring a closed/frozen/stuck case must also return it to an active
    // stage — un-archiving alone would plant a case with an auto-archiving
    // status inside the active list, breaking the closed/on_hold/stuck ⇔
    // archived invariant (migrations 226/227). The RPC resolves the last
    // active stage from the case's history; NULL means the current status is
    // already active. FAIL CLOSED on any obstacle: an aborted restore leaves
    // the case safely findable in the archive, a half-restore corrupts state.
    const { data: revertStatusId, error: revertError } = await supabase.rpc(
      'get_restore_target_status',
      { p_case_id: caseId },
    );
    if (revertError) {
      console.error('[toggleArchive] restore-status lookup failed', safeDbError(revertError));
      return { ok: false, error: 'unknown' };
    }
    if (revertStatusId) {
      // The trusted-columns guard (migration 178) enforces change_case_status
      // on any status write, so restoring a closed/frozen case requires it.
      if (!(await userHasPermission('change_case_status'))) {
        return { ok: false, error: 'unauthorized' };
      }
      payload.status_id = revertStatusId;
    }
  }

  const { data: updated, error } = await supabase
    .from('cases')
    .update(payload)
    .eq('id', caseId)
    .select('id');

  if (error) {
    console.error('[toggleArchive] db error', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };
  // The caller (CaseMoreMenu) already calls router.refresh() on success, which re-
  // renders the current /cases/[id] page — so revalidating it here just doubled the
  // heavy re-render and kept the menu's pending state up. Purge the dashboard list
  // AFTER the response (the user stays on the case page; /cases matters on the next
  // visit, when the archived filter must reflect the change).
  after(() => revalidatePath('/cases'));
  return { ok: true };
}
