import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

import {
  MIN_AUTO_SYNC_INTERVAL_MS,
  NAME_TO_FOLDER_KEY,
  type CaseDriveMeta,
  type DriveSyncOutcome,
  type ExistingDocEntry,
  type SyncRunState,
} from '../domain/drive-sync-types';

import { getDriveClientIfConnected } from './drive-case-uploader';
import { importOrUpdateDriveFile } from './drive-sync-importer';
import { sweepVanishedDriveFiles } from './drive-sync-sweeper';
import { type GoogleDriveClient } from './google-drive';

export type { DriveSyncOutcome };
export type { GoogleDriveClient };

/** Best-effort auto-sync: skips if recently synced or Drive isn't connected. */
export async function autoSyncIfStale(caseId: string): Promise<void> {
  const supabase = await createClient();
  const { data: caseRow } = await supabase
    .from('cases')
    .select('metadata')
    .eq('id', caseId)
    .maybeSingle();
  if (!caseRow) return;

  const drive = readDriveMeta(caseRow.metadata);
  if (!drive.case_folder_id) return; // never uploaded - nothing to sync
  if (drive.last_synced_at) {
    const ageMs = Date.now() - new Date(drive.last_synced_at).getTime();
    if (ageMs < MIN_AUTO_SYNC_INTERVAL_MS) return;
  }

  await syncDriveDocumentsForCase(caseId).catch((err) => {
    // Auto-sync is best-effort but silent failure hides real problems
    // (expired refresh, scope revoked, Drive outage). Log so it shows up
    // in server logs / Sentry instead of vanishing.
    console.error('drive auto-sync failed', { caseId, err });
  });
}

/**
 * Atomic stamp of cases.metadata.drive.last_synced_at via the dedicated RPC
 * (migration 026). Replaces the previous read-modify-write that could lose
 * concurrent writes to sibling drive.* keys.
 */
async function persistLastSyncedAt(caseId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc('update_case_drive_meta', {
    p_case_id: caseId,
    // JSON-shaped literal; widen at the call boundary.
    p_patch: { last_synced_at: new Date().toISOString() } as unknown as Json,
  });
}

function readDriveMeta(raw: Json | null): CaseDriveMeta {
  if (!raw || typeof raw !== 'object' || !('drive' in raw)) return {};
  return ((raw as { drive: CaseDriveMeta }).drive ?? {}) as CaseDriveMeta;
}

/**
 * Pull files from the case's Drive subfolders into the documents table.
 * - Lists subfolders dynamically (doesn't rely on cached metadata)
 * - Matches by Hebrew folder name to drive_folder enum
 * - Files dropped at case-folder root land as "uncategorized" (the
 *   advisor categorizes them from the UI)
 * - Files already linked by drive_file_id are skipped
 * - Files missing across a 48h grace window are soft-deleted (sweeper)
 */
export async function syncDriveDocumentsForCase(caseId: string): Promise<DriveSyncOutcome> {
  const client = await getDriveClientIfConnected();
  if (!client) return { ok: false, reason: 'not_connected' };

  const supabase = await createClient();

  const { data: caseRow } = await supabase
    .from('cases')
    .select('id, metadata')
    .eq('id', caseId)
    .maybeSingle();
  if (!caseRow) return { ok: false, reason: 'case_not_found' };

  const drive = readDriveMeta(caseRow.metadata);
  if (!drive.case_folder_id) return { ok: false, reason: 'no_folder' };

  const [categoriesRes, existingRes, tombstonesRes] = await Promise.all([
    supabase
      .from('document_categories')
      .select('id, key, drive_folder, sort_order')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('documents')
      .select('id, drive_file_id, metadata, category:category_id(drive_folder)')
      .eq('case_id', caseId)
      .is('deleted_at', null)
      .not('drive_file_id', 'is', null),
    supabase.from('document_drive_tombstones').select('drive_file_id').eq('case_id', caseId),
  ]);
  if (tombstonesRes.error) {
    return { ok: false, reason: 'error', message: tombstonesRes.error.message };
  }

  const firstCategoryPerFolder = new Map<string, string>();
  for (const c of categoriesRes.data ?? []) {
    if (!firstCategoryPerFolder.has(c.drive_folder)) {
      firstCategoryPerFolder.set(c.drive_folder, c.id);
    }
  }

  const existingByDriveId = new Map<string, ExistingDocEntry>();
  for (const e of existingRes.data ?? []) {
    if (!e.drive_file_id) continue;
    const cat = e.category as { drive_folder?: string } | null;
    const meta =
      e.metadata && typeof e.metadata === 'object' && !Array.isArray(e.metadata)
        ? (e.metadata as Record<string, unknown>)
        : {};
    existingByDriveId.set(e.drive_file_id, {
      docId: e.id,
      currentDriveFolder: cat?.drive_folder ?? null,
      existingMetadata: meta,
    });
  }

  const state: SyncRunState = {
    imported: 0,
    updated: 0,
    skipped: 0,
    deleted: 0,
    seenDriveIds: new Set<string>(),
    tombstonedDriveIds: new Set((tombstonesRes.data ?? []).map((t) => t.drive_file_id)),
    existingByDriveId,
    listingsComplete: true,
  };

  const safeListFiles = async (folderId: string) => {
    try {
      return await client.listFolderFilesPaginated(folderId);
    } catch {
      state.listingsComplete = false;
      return [];
    }
  };
  const safeListSubfolders = async (folderId: string) => {
    try {
      return await client.listSubfolders(folderId);
    } catch {
      state.listingsComplete = false;
      return [];
    }
  };

  try {
    // Subfolders scanned dynamically — matches even if our cache is stale.
    const subfolders = await safeListSubfolders(drive.case_folder_id);
    for (const sub of subfolders) {
      const folderKey = NAME_TO_FOLDER_KEY[sub.name];
      if (!folderKey) continue;
      const categoryId = firstCategoryPerFolder.get(folderKey);
      if (!categoryId) continue;
      const files = await safeListFiles(sub.id);
      for (const f of files) {
        await importOrUpdateDriveFile(caseId, f, categoryId, folderKey, state);
      }
    }

    // Files at the case-folder root land as uncategorized (category_id = null).
    const rootFiles = await safeListFiles(drive.case_folder_id);
    for (const f of rootFiles) {
      await importOrUpdateDriveFile(caseId, f, null, null, state);
    }

    await sweepVanishedDriveFiles(state);
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : 'unknown',
    };
  }

  await persistLastSyncedAt(caseId);
  return {
    ok: true,
    imported: state.imported,
    updated: state.updated,
    skipped: state.skipped,
    deleted: state.deleted,
  };
}
