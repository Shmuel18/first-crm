import { createClient } from '@/lib/supabase/server';

import { type SyncRunState } from '../domain/drive-sync-types';

/**
 * Soft-delete docs whose Drive file is gone, in the same pass that noticed.
 * Deleting in Drive is how this office deletes; a document that survived the
 * sync read as "the sync is broken", so there is no grace period.
 *
 * The one safety left is `listingsComplete`: if ANY Drive list call failed
 * this pass, a healthy file can look missing, so the sweep is skipped
 * entirely rather than acting on a partial picture. Deletes go through the
 * same permission-checked RPC as an explicit UI delete so the Drive tombstone
 * is written atomically and a deleted file cannot be re-imported later.
 */
export async function sweepVanishedDriveFiles(caseId: string, state: SyncRunState): Promise<void> {
  if (!state.listingsComplete) return;
  const supabase = await createClient();
  const { data: userRes, error: authError } = await supabase.auth.getUser();
  if (authError || !userRes.user) {
    throw new Error('Drive sync could not authorize document removal');
  }

  for (const [driveId, entry] of state.existingByDriveId) {
    if (state.seenDriveIds.has(driveId)) continue;
    if (!entry.docId) continue;

    const { error } = await supabase.rpc('soft_delete_document_with_tombstone', {
      p_document_id: entry.docId,
      p_case_id: caseId,
      p_user_id: userRes.user.id,
    });
    if (error) {
      throw new Error(`Drive sync could not remove document: ${error.message}`);
    }
    state.deleted += 1;
  }
}
