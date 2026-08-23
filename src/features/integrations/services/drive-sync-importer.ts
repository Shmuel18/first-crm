import { after } from 'next/server';

import { classifyDocumentInBackground } from '@/features/documents/services/ai-classification.service';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

import type { DriveFileMeta } from '../domain/drive-folder-naming';
import type { SyncRunState } from '../domain/drive-sync-types';

export type DriveFileLocation = {
  parentFolderId: string;
  /** Display-name path from the managed case root to the direct parent. */
  relativePath: string[];
};

function normalizedSize(size: string | undefined): number | null {
  if (!size) return null;
  const parsed = Number(size);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function stringArraysEqual(left: unknown, right: string[]): boolean {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

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
  location: DriveFileLocation,
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
    const nextMetadata: Record<string, unknown> = {
      ...metaWithoutMissing,
      drive_parent_folder_id: location.parentFolderId,
      drive_relative_path: [...location.relativePath],
    };
    const nextFileSize = normalizedSize(file.size);
    const categoryChanged = found.currentDriveFolder !== driveFolder;
    const locationChanged =
      found.existingMetadata.drive_parent_folder_id !== location.parentFolderId ||
      !stringArraysEqual(found.existingMetadata.drive_relative_path, location.relativePath);
    const fileMetadataChanged =
      found.currentFileName !== file.name ||
      found.currentFileSize !== nextFileSize ||
      found.currentMimeType !== file.mimeType;

    if (categoryChanged || locationChanged || fileMetadataChanged || wasMarkedMissing) {
      // Merge with existing metadata - replacing the whole JSONB would wipe
      // storage_path (and any other app-owned keys) on mirrored uploads.
      const { data: updated, error } = await supabase
        .from('documents')
        .update({
          category_id: categoryId,
          file_name: file.name,
          file_size: nextFileSize,
          mime_type: file.mimeType,
          metadata: nextMetadata as unknown as Json,
        })
        .eq('id', found.docId)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle();
      if (error) {
        throw new Error(`Drive sync could not update document: ${error.message}`);
      }
      if (!updated) {
        // A concurrent explicit delete/detach won. Do not overwrite its audit
        // metadata or report an update that never reached an active row.
        state.skipped += 1;
        return;
      }

      if (categoryChanged || locationChanged || fileMetadataChanged) {
        state.updated += 1;
      } else {
        // Clearing a legacy missing marker is bookkeeping, not a user-visible
        // document change.
        state.skipped += 1;
      }
      found.currentDriveFolder = driveFolder;
      found.currentFileName = file.name;
      found.currentFileSize = nextFileSize;
      found.currentMimeType = file.mimeType;
      found.existingMetadata = nextMetadata;
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
      file_size: normalizedSize(file.size),
      mime_type: file.mimeType,
      drive_file_id: file.id,
      drive_file_url: file.webViewLink,
      // A complete, trusted Drive listing is the validation boundary. Kaufman
      // has no separate human-review queue, so imported files are immediately
      // accepted just like uploads made through the site.
      status: 'verified',
      metadata: {
        source: 'drive_sync',
        drive_parent_folder_id: location.parentFolderId,
        drive_relative_path: [...location.relativePath],
      },
    })
    .select('id')
    .single();
  if (!error && inserted) {
    state.imported += 1;
    state.existingByDriveId.set(file.id, {
      docId: inserted.id,
      currentDriveFolder: driveFolder,
      currentFileName: file.name,
      currentFileSize: normalizedSize(file.size),
      currentMimeType: file.mimeType,
      existingMetadata: {
        source: 'drive_sync',
        drive_parent_folder_id: location.parentFolderId,
        drive_relative_path: [...location.relativePath],
      },
    });
    // AI classification for files that landed WITHOUT a category (unmapped
    // Drive folder) — the exact population the exceptions queue exists for.
    // Background via after(), fail-soft, no-op when the flag is off. Files
    // with a folder-derived category are validated on upload paths instead.
    if (categoryId === null) {
      after(async () => {
        await classifyDocumentInBackground(inserted.id);
      });
    }
  } else {
    throw new Error(
      `Drive sync could not import document: ${error?.message ?? 'insert returned no row'}`,
    );
  }
}
