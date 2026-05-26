import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

import { VANISHED_FILE_GRACE_PERIOD_MS, type SyncRunState } from '../domain/drive-sync-types';

/**
 * Soft-delete docs whose Drive file vanished, with a grace period:
 *   first time missing → stamp metadata.drive_missing_since = now, keep row
 *   missing ≥ 48h     → soft-delete + clear the flag
 *
 * If the file reappears between syncs, the importer clears the flag, so the
 * clock effectively resets. Only runs when all list calls succeeded —
 * `state.listingsComplete=false` means a transient API hiccup could mark
 * healthy docs as missing, so we bail.
 */
export async function sweepVanishedDriveFiles(state: SyncRunState): Promise<void> {
  if (!state.listingsComplete) return;
  const supabase = await createClient();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  for (const [driveId, entry] of state.existingByDriveId) {
    if (state.seenDriveIds.has(driveId)) continue;
    if (!entry.docId) continue;

    const missingSinceRaw = entry.existingMetadata.drive_missing_since;
    const missingSince = typeof missingSinceRaw === 'string' ? missingSinceRaw : null;

    if (!missingSince) {
      // First sync that didn't see the file. Start the grace clock.
      await supabase
        .from('documents')
        .update({
          metadata: { ...entry.existingMetadata, drive_missing_since: nowIso },
        })
        .eq('id', entry.docId);
      continue;
    }

    const missingForMs = nowMs - new Date(missingSince).getTime();
    if (missingForMs < VANISHED_FILE_GRACE_PERIOD_MS) continue;

    // Grace expired - soft-delete and clear the flag in one shot.
    const cleared: Record<string, unknown> = { ...entry.existingMetadata };
    delete cleared.drive_missing_since;
    const { error } = await supabase
      .from('documents')
      // Record<string, unknown> → Json widening at the boundary.
      .update({ deleted_at: nowIso, metadata: cleared as unknown as Json })
      .eq('id', entry.docId);
    if (!error) state.deleted += 1;
  }
}
