import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

import {
  MIN_AUTO_SYNC_INTERVAL_MS,
  NAME_TO_FOLDER_KEY,
  type CaseDriveMeta,
  type DriveFolderSnapshotEntry,
  type DriveSyncOutcome,
  type ExistingDocEntry,
  type SyncRunState,
} from '../domain/drive-sync-types';

import { getDriveClientIfConnected } from './drive-case-uploader';
import { pushLocalOnlyFilesToDrive } from './drive-push-backfill';
import { importOrUpdateDriveFile } from './drive-sync-importer';
import { sweepVanishedDriveFiles } from './drive-sync-sweeper';
import { type GoogleDriveClient } from './google-drive';

export type { DriveSyncOutcome };
export type { GoogleDriveClient };

type DriveSyncOptions = {
  /** Production actions always enable exact reconciliation. Optional only so
   * read-focused service tests can exercise traversal without an auth RPC. */
  deleteVanishedFiles?: boolean;
};

/** Best-effort auto-sync: returns null when no Drive pass was needed. */
export async function autoSyncIfStale(
  caseId: string,
  options: DriveSyncOptions = {},
): Promise<DriveSyncOutcome | null> {
  const supabase = await createClient();
  const { data: caseRow, error } = await supabase
    .from('cases')
    .select('metadata')
    .eq('id', caseId)
    .maybeSingle();
  if (error) return { ok: false, reason: 'error', message: error.message };
  if (!caseRow) return null;

  const drive = readDriveMeta(caseRow.metadata);
  if (!drive.case_folder_id) return null; // never uploaded - nothing to sync
  if (drive.last_synced_at) {
    const ageMs = Date.now() - new Date(drive.last_synced_at).getTime();
    if (ageMs < MIN_AUTO_SYNC_INTERVAL_MS) return null;
  }

  return syncDriveDocumentsForCase(caseId, options);
}

/**
 * Atomic stamp of cases.metadata.drive.last_synced_at via the dedicated RPC
 * (migration 026). Replaces the previous read-modify-write that could lose
 * concurrent writes to sibling drive.* keys.
 */
async function persistDriveSnapshot(
  caseId: string,
  folderTree: DriveFolderSnapshotEntry[],
  subfolders: Partial<Record<string, string>>,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_case_drive_meta', {
    p_case_id: caseId,
    // JSON-shaped literal; widen at the call boundary.
    p_patch: {
      folder_tree: folderTree,
      subfolders,
      last_synced_at: new Date().toISOString(),
    } as unknown as Json,
  });
  if (error) {
    throw new Error(`Drive sync could not persist its folder snapshot: ${error.message}`);
  }
}

function readDriveMeta(raw: Json | null): CaseDriveMeta {
  if (!raw || typeof raw !== 'object' || !('drive' in raw)) return {};
  return ((raw as { drive: CaseDriveMeta }).drive ?? {}) as CaseDriveMeta;
}

function normalizedFolderTree(raw: unknown): DriveFolderSnapshotEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries = raw.filter((entry): entry is DriveFolderSnapshotEntry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const candidate = entry as Partial<DriveFolderSnapshotEntry>;
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.parent_id === 'string' &&
      typeof candidate.name === 'string' &&
      Array.isArray(candidate.relative_path) &&
      candidate.relative_path.every((part) => typeof part === 'string')
    );
  });
  return entries.toSorted((a, b) => {
    const byPath = a.relative_path.join('\u0000').localeCompare(b.relative_path.join('\u0000'));
    return byPath || a.id.localeCompare(b.id);
  });
}

function folderTreesEqual(left: unknown, right: DriveFolderSnapshotEntry[]): boolean {
  return JSON.stringify(normalizedFolderTree(left)) === JSON.stringify(normalizedFolderTree(right));
}

function normalizedSubfolders(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

const MAX_DRIVE_ANCESTORS_PER_FILE = 100;

/**
 * Prove that an unseen, still-live Drive file no longer descends from any
 * folder observed in the trusted case-tree snapshot. Returning false means
 * the files.list snapshot contradicted files.get, so the whole pass must fail
 * closed rather than deleting a healthy document.
 */
async function proveFileOutsideManagedTree(
  client: GoogleDriveClient,
  fileId: string,
  managedFolderIds: Set<string>,
  placementCache: Map<string, Awaited<ReturnType<GoogleDriveClient['getFilePlacement']>>>,
): Promise<boolean> {
  const getPlacement = async (id: string) => {
    if (placementCache.has(id)) return placementCache.get(id) ?? null;
    const placement = await client.getFilePlacement(id);
    placementCache.set(id, placement);
    return placement;
  };

  const file = await getPlacement(fileId);
  if (!file || file.trashed) return true;

  const pendingParents = [...file.parents];
  const checkedAncestors = new Set<string>();
  while (pendingParents.length > 0) {
    const parentId = pendingParents.shift();
    if (!parentId) continue;
    if (managedFolderIds.has(parentId)) return false;
    if (checkedAncestors.has(parentId)) {
      throw new Error('Drive ancestry was cyclic or ambiguous');
    }
    if (checkedAncestors.size >= MAX_DRIVE_ANCESTORS_PER_FILE) {
      throw new Error('Drive ancestry exceeded the reconciliation safety limit');
    }
    checkedAncestors.add(parentId);

    const parent = await getPlacement(parentId);
    if (!parent) {
      throw new Error('Drive could not verify a file ancestor');
    }
    if (parent.trashed) continue;
    pendingParents.push(...parent.parents);
  }

  return true;
}

/**
 * Pull files from the case's Drive subfolders into the documents table.
 * - Recursively lists the entire managed case-folder tree
 * - Matches the top-level Hebrew folder name to drive_folder enum and carries
 *   that category through every nested descendant
 * - Files dropped at case-folder root land as "uncategorized" (the
 *   advisor categorizes them from the UI)
 * - Files already linked by drive_file_id are skipped
 * - Files missing from a complete Drive listing are soft-deleted immediately
 * - App-uploaded files whose after() Drive mirror failed are pushed to
 *   Drive at the end of the pass (push backfill)
 */
export async function syncDriveDocumentsForCase(
  caseId: string,
  options: DriveSyncOptions = {},
): Promise<DriveSyncOutcome> {
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

  try {
    if (!(await client.isManagedCaseFolder(drive.case_folder_id, caseId))) {
      return {
        ok: false,
        reason: 'error',
        message: 'Case Drive folder is missing or does not belong to this case',
      };
    }
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : 'Drive case folder verification failed',
    };
  }

  const [categoriesRes, existingRes, tombstonesRes] = await Promise.all([
    supabase
      .from('document_categories')
      .select('id, key, drive_folder, sort_order')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('documents')
      .select(
        'id, drive_file_id, drive_file_url, file_name, file_size, mime_type, metadata, category:category_id(drive_folder)',
      )
      .eq('case_id', caseId)
      .is('deleted_at', null)
      .not('drive_file_id', 'is', null),
    supabase.from('document_drive_tombstones').select('drive_file_id').eq('case_id', caseId),
  ]);
  // All three reference reads must succeed before we import or sweep. The
  // listingsComplete guard only covers Drive *listing* failures; a transient
  // failure of these DB reads is just as dangerous and slips past it:
  //  - categories fails → empty folder→category map → every subfolder's files
  //    are skipped (never added to seenDriveIds), so the sweeper treats present
  //    files as "missing" and soft-deletes them once the grace window expires.
  //  - existing-docs fails → empty existingByDriveId → every Drive file looks
  //    new → duplicate document rows on re-import.
  const refError = categoriesRes.error ?? existingRes.error ?? tombstonesRes.error;
  if (refError) {
    return { ok: false, reason: 'error', message: refError.message };
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
      currentFileName: e.file_name,
      currentFileSize: e.file_size,
      currentMimeType: e.mime_type,
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
  const changedBeforeFailure = () => state.imported > 0 || state.updated > 0 || state.deleted > 0;
  const failureAfterReconciliationStarted = (message: string): DriveSyncOutcome => ({
    ok: false,
    reason: 'error',
    message,
    ...(changedBeforeFailure() ? { changed: true as const } : {}),
  });

  const recordListingFailure = (err: unknown) => {
    state.listingsComplete = false;
    state.listingFailure ??= err instanceof Error ? err.message : 'Drive listing failed';
  };

  const safeListFiles = async (folderId: string) => {
    try {
      return await client.listFolderFilesPaginated(folderId);
    } catch (err) {
      recordListingFailure(err);
      return [];
    }
  };
  const safeListSubfolders = async (folderId: string) => {
    try {
      return await client.listSubfolders(folderId);
    } catch (err) {
      recordListingFailure(err);
      return [];
    }
  };

  try {
    // Files at the case-folder root land as uncategorized (category_id = null).
    const rootFiles = await safeListFiles(drive.case_folder_id);
    for (const f of rootFiles) {
      await importOrUpdateDriveFile(caseId, f, null, null, state, {
        parentFolderId: drive.case_folder_id,
        relativePath: [],
      });
    }

    type PendingFolder = DriveFolderSnapshotEntry & {
      categoryId: string | null;
      driveFolder: string | null;
    };
    const pendingFolders: PendingFolder[] = [];
    const topLevelFolders = await safeListSubfolders(drive.case_folder_id);
    const topLevelById = new Map(topLevelFolders.map((folder) => [folder.id, folder]));
    const resolvedSubfolders: Partial<Record<string, string>> = {};
    for (const [folderName, folderKey] of Object.entries(NAME_TO_FOLDER_KEY)) {
      const cachedId = drive.subfolders?.[folderKey];
      if (cachedId && topLevelById.has(cachedId)) {
        resolvedSubfolders[folderKey] = cachedId;
        continue;
      }
      const nameMatches = topLevelFolders.filter((folder) => folder.name === folderName);
      if (nameMatches.length === 1 && nameMatches[0]) {
        resolvedSubfolders[folderKey] = nameMatches[0].id;
      }
    }
    const resolvedFolderKeyById = new Map<string, string>();
    for (const [folderKey, folderId] of Object.entries(resolvedSubfolders)) {
      if (folderId) resolvedFolderKeyById.set(folderId, folderKey);
    }
    for (const folder of topLevelFolders) {
      // Only resolved DIRECT children are canonical category roots. Stable
      // cached ids survive renames; a stale/moved id is healed by one unique
      // canonical-name match. Ambiguous duplicate names remain custom.
      const matchedFolder = resolvedFolderKeyById.get(folder.id) ?? null;
      const categoryId = matchedFolder ? (firstCategoryPerFolder.get(matchedFolder) ?? null) : null;
      pendingFolders.push({
        id: folder.id,
        parent_id: drive.case_folder_id,
        name: folder.name,
        relative_path: [folder.name],
        categoryId,
        // A known Drive folder without an active DB category is treated as
        // uncategorized so its files remain visible instead of disappearing.
        driveFolder: categoryId ? matchedFolder : null,
      });
    }

    const folderTree: DriveFolderSnapshotEntry[] = [];
    const visitedFolderIds = new Set<string>([drive.case_folder_id]);
    for (let index = 0; index < pendingFolders.length; index += 1) {
      const folder = pendingFolders[index];
      if (!folder) continue;
      if (visitedFolderIds.has(folder.id)) continue;
      visitedFolderIds.add(folder.id);
      folderTree.push({
        id: folder.id,
        parent_id: folder.parent_id,
        name: folder.name,
        relative_path: folder.relative_path,
      });

      const files = await safeListFiles(folder.id);
      for (const file of files) {
        await importOrUpdateDriveFile(caseId, file, folder.categoryId, folder.driveFolder, state, {
          parentFolderId: folder.id,
          relativePath: folder.relative_path,
        });
      }

      const children = await safeListSubfolders(folder.id);
      for (const child of children) {
        pendingFolders.push({
          id: child.id,
          parent_id: folder.id,
          name: child.name,
          relative_path: [...folder.relative_path, child.name],
          categoryId: folder.categoryId,
          driveFolder: folder.driveFolder,
        });
      }
    }

    const trustedFolderTree = normalizedFolderTree(folderTree);

    // Once the recursive listing is complete, an unseen file is outside this
    // managed case tree (or trashed). Drive is the source of truth, so it must
    // disappear from the site even if the file id is still live elsewhere.
    // Never infer this from a partial tree.
    if (!state.listingsComplete) {
      return failureAfterReconciliationStarted(state.listingFailure ?? 'Drive listing incomplete');
    }

    // A successful list request can still (rarely) return an anomalously empty
    // page. Before destructive reconciliation, independently inspect each
    // unseen file and walk its parents. If it still reaches the case tree, the
    // snapshot was inconsistent and the entire pass fails without sweeping.
    const placementCache = new Map<
      string,
      Awaited<ReturnType<GoogleDriveClient['getFilePlacement']>>
    >();
    for (const driveId of state.existingByDriveId.keys()) {
      if (state.seenDriveIds.has(driveId)) continue;
      if (!(await proveFileOutsideManagedTree(client, driveId, visitedFolderIds, placementCache))) {
        return failureAfterReconciliationStarted(
          `Drive listing was inconsistent for file ${driveId}`,
        );
      }
    }

    if (options.deleteVanishedFiles) {
      await sweepVanishedDriveFiles(caseId, state);
    }

    if (
      !folderTreesEqual(drive.folder_tree, trustedFolderTree) ||
      JSON.stringify(normalizedSubfolders(drive.subfolders)) !==
        JSON.stringify(normalizedSubfolders(resolvedSubfolders))
    ) {
      // Reuse the existing changed counter so empty-folder create/rename/move
      // refreshes the current documents view as well.
      state.updated += 1;
    }

    // Persist only a complete snapshot. A failed RPC also fails the pass and
    // leaves last_synced_at untouched so the next visit retries promptly.
    await persistDriveSnapshot(caseId, trustedFolderTree, resolvedSubfolders);
  } catch (err) {
    return failureAfterReconciliationStarted(err instanceof Error ? err.message : 'unknown');
  }

  // Push direction AFTER pull+sweep (ordering matters — see the helper's doc).
  // Best-effort: a push failure never fails the sync.
  const pushed = await pushLocalOnlyFilesToDrive(caseId);

  return {
    ok: true,
    imported: state.imported,
    updated: state.updated,
    skipped: state.skipped,
    deleted: state.deleted,
    pushed,
  };
}
