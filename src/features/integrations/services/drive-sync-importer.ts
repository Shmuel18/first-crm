import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

import type { DriveFileMeta } from '../domain/drive-folder-naming';
import type { SyncRunState } from '../domain/drive-sync-types';

/**
 * Insert-or-update a single Drive file into the documents table for a case.
 * Mutates `state` (counters + existingByDriveId map) so the caller can keep
 * running totals across the whole sync pass.
 *
 * Three branches:
 *  1. tombstoned → skip (we deleted it on purpose; don't resurrect)
 *  2. already known by drive_file_id → check for category move or missing-flag
 *     clear; UPDATE if so, else count as skipped
 *  3. new → INSERT a documents row
 */
export async function importOrUpdateDriveFile(
  caseId: string,
  file: DriveFileMeta,
  categoryId: string | null,
  driveFolder: string | null,
  state: SyncRunState,
): Promise<void> {
  if (state.tombstonedDriveIds.has(file.id)) {
    state.skipped += 1;
    return;
  }

  state.seenDriveIds.add(file.id);
  const supabase = await createClient();
  const found = state.existingByDriveId.get(file.id);

  if (found) {
    // If the file was previously marked missing, clear that flag now -
    // it has reappeared, no need to keep counting toward soft-delete.
    const wasMarkedMissing = 'drive_missing_since' in found.existingMetadata;
    const metaWithoutMissing: Record<string, unknown> = { ...found.existingMetadata };
    delete metaWithoutMissing.drive_missing_since;

    if (found.currentDriveFolder !== driveFolder) {
      // Move detected. Merge with existing metadata - replacing the whole
      // JSONB would wipe storage_path (and any other keys) on app-uploaded
      // files.
      await supabase
        .from('documents')
        .update({
          category_id: categoryId,
          metadata: { ...metaWithoutMissing, source: 'drive_sync' },
        })
        .eq('id', found.docId);
      state.updated += 1;
      found.currentDriveFolder = driveFolder;
      found.existingMetadata = { ...metaWithoutMissing, source: 'drive_sync' };
    } else if (wasMarkedMissing) {
      // Same folder, but file is back. Clear the flag without bumping
      // updated count (visually nothing changed for the advisor).
      await supabase
        .from('documents')
        // Record<string, unknown> → Json widening at the boundary.
        .update({ metadata: metaWithoutMissing as unknown as Json })
        .eq('id', found.docId);
      found.existingMetadata = metaWithoutMissing;
      state.skipped += 1;
    } else {
      state.skipped += 1;
    }
    return;
  }

  const { data: inserted, error } = await supabase
    .from('documents')
    .insert({
      case_id: caseId,
      category_id: categoryId,
      file_name: file.name,
      file_size: file.size ? Number(file.size) : null,
      mime_type: file.mimeType,
      drive_file_id: file.id,
      drive_file_url: file.webViewLink,
      status: 'new',
      metadata: { source: 'drive_sync' },
    })
    .select('id')
    .single();
  if (!error && inserted) {
    state.imported += 1;
    state.existingByDriveId.set(file.id, {
      docId: inserted.id,
      currentDriveFolder: driveFolder,
      existingMetadata: { source: 'drive_sync' },
    });
  }
}
