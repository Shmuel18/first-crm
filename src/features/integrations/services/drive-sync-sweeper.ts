import { createClient } from '@/lib/supabase/server';

import { type SyncRunState } from '../domain/drive-sync-types';

/**
 * Soft-delete docs whose Drive file is gone, in the same pass that noticed.
 * Deleting in Drive is how this office deletes; a document that survived the
 * sync read as "the sync is broken", so there is no grace period.
 *
 * The one safety left is `listingsComplete`: if ANY Drive list call failed
 * this pass, a healthy file can look missing, so the sweep is skipped
 * entirely rather than acting on a partial picture. Deletes are soft
 * (deleted_at + tombstone semantics downstream), so a wrongful one is
 * recoverable inside the retention window.
 */
export async function sweepVanishedDriveFiles(state: SyncRunState): Promise<void> {
  if (!state.listingsComplete) return;
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  for (const [driveId, entry] of state.existingByDriveId) {
    if (state.seenDriveIds.has(driveId)) continue;
    if (!entry.docId) continue;

    const { error } = await supabase
      .from('documents')
      .update({ deleted_at: nowIso })
      .eq('id', entry.docId);
    if (!error) state.deleted += 1;
  }
}
