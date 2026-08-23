import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import { type SyncRunState } from '../domain/drive-sync-types';

/**
 * Soft-delete docs that no longer belong to the managed case-folder tree, in
 * the same complete pass that noticed.
 *
 * The one safety left is `listingsComplete`: if ANY Drive list call failed
 * this pass, a healthy file can look missing, so the sweep is skipped
 * entirely rather than acting on a partial picture. This deliberately uses
 * the exact-mirror detach RPC rather than the explicit
 * UI-delete RPC: it clears active Drive pointers and writes no tombstone. That
 * prevents retention from deleting a still-live file moved elsewhere, and
 * allows the same Drive id to be imported again if the user moves it back.
 * The detach RPC is service-role-only; the authenticated session supplies the
 * audited actor after the sync action has already enforced edit+upload access.
 */
export async function sweepVanishedDriveFiles(caseId: string, state: SyncRunState): Promise<void> {
  if (!state.listingsComplete) return;
  const supabase = await createClient();
  const { data: userRes, error: authError } = await supabase.auth.getUser();
  if (authError || !userRes.user) {
    throw new Error('Drive sync could not authorize document removal');
  }
  const admin = createAdminClient();

  for (const [driveId, entry] of state.existingByDriveId) {
    if (state.seenDriveIds.has(driveId)) continue;
    if (!entry.docId) continue;

    const { data: removed, error } = await admin.rpc(
      'soft_delete_drive_document_without_tombstone',
      {
        p_document_id: entry.docId,
        p_case_id: caseId,
        p_user_id: userRes.user.id,
      },
    );
    if (error) {
      throw new Error(`Drive sync could not remove document: ${error.message}`);
    }
    // Another sync or an explicit UI delete can win after our reference
    // snapshot. The RPC's permission errors still fail loudly, but a false
    // result is an idempotent already-gone race rather than a broken pass.
    if (!removed) continue;
    state.deleted += 1;
  }
}
