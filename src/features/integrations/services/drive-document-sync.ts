import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

import { DRIVE_SUBFOLDER_NAMES, type GoogleDriveClient } from './google-drive';
import { getDriveClientIfConnected } from './drive-case-uploader';

type CaseDriveMeta = {
  case_folder_id?: string;
  subfolders?: Partial<Record<string, string>>;
  last_synced_at?: string;
};

/** Auto-sync on page load only if last sync was older than this. */
const MIN_AUTO_SYNC_INTERVAL_MS = 10_000;

/**
 * Grace period before a vanished Drive file is soft-deleted from our DB.
 * If a file is missing across multiple syncs for less than this, we keep
 * the doc record and just stamp drive_missing_since on its metadata. After
 * the grace expires (still missing) → soft-delete. If the file reappears
 * within the window → clear the flag, no harm done.
 *
 * Protects against accidental drag-out / cloud sync hiccups that would
 * otherwise wipe real documents from the office's view in one cycle.
 */
const VANISHED_FILE_GRACE_PERIOD_MS = 48 * 60 * 60 * 1000; // 48h

/** Best-effort auto-sync: skips if recently synced or Drive isn't connected. */
export async function autoSyncIfStale(caseId: string): Promise<void> {
  const supabase = await createClient();
  const { data: caseRow } = await supabase
    .from('cases')
    .select('metadata')
    .eq('id', caseId)
    .maybeSingle();
  if (!caseRow) return;

  const drive: CaseDriveMeta =
    caseRow.metadata && typeof caseRow.metadata === 'object' && 'drive' in caseRow.metadata
      ? ((caseRow.metadata as { drive: CaseDriveMeta }).drive ?? {})
      : {};

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

export type DriveSyncOutcome =
  | { ok: true; imported: number; updated: number; skipped: number; deleted: number }
  | {
      ok: false;
      reason: 'not_connected' | 'case_not_found' | 'no_folder' | 'error';
      message?: string;
    };

/** Reverse map: folder name (Hebrew) → drive_folder enum key. */
const NAME_TO_FOLDER_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(DRIVE_SUBFOLDER_NAMES).map(([key, name]) => [name, key]),
);

/**
 * Pull files from the case's Drive subfolders into the documents table.
 * - Lists subfolders dynamically (doesn't rely on cached metadata)
 * - Matches by Hebrew folder name to drive_folder enum
 * - Files dropped at case-folder root are imported as 'identity' (sensible default)
 * - Files already linked by drive_file_id are skipped
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

  const drive: CaseDriveMeta =
    caseRow.metadata && typeof caseRow.metadata === 'object' && 'drive' in caseRow.metadata
      ? ((caseRow.metadata as { drive: CaseDriveMeta }).drive ?? {})
      : {};
  if (!drive.case_folder_id) return { ok: false, reason: 'no_folder' };

  const { data: categories } = await supabase
    .from('document_categories')
    .select('id, key, drive_folder, sort_order')
    .eq('is_active', true)
    .order('sort_order');

  const firstCategoryPerFolder = new Map<string, string>();
  for (const c of categories ?? []) {
    if (!firstCategoryPerFolder.has(c.drive_folder)) {
      firstCategoryPerFolder.set(c.drive_folder, c.id);
    }
  }

  const { data: existing } = await supabase
    .from('documents')
    .select('id, drive_file_id, metadata, category:category_id(drive_folder)')
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .not('drive_file_id', 'is', null);

  const { data: tombstones, error: tombstonesErr } = await supabase
    .from('document_drive_tombstones')
    .select('drive_file_id')
    .eq('case_id', caseId);
  if (tombstonesErr) {
    return { ok: false, reason: 'error', message: tombstonesErr.message };
  }
  const tombstonedDriveIds = new Set((tombstones ?? []).map((t) => t.drive_file_id));

  const existingByDriveId = new Map<
    string,
    {
      docId: string;
      currentDriveFolder: string | null;
      existingMetadata: Record<string, unknown>;
    }
  >();
  for (const e of existing ?? []) {
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

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let deleted = 0;
  // Track which existing drive_file_ids we actually saw this pass.
  const seenDriveIds = new Set<string>();
  // If a Drive list call fails for any subfolder/root, we must skip the
  // deletion sweep - otherwise we'd soft-delete healthy docs whose folder
  // we couldn't enumerate this time around.
  let listingsComplete = true;

  try {
    const importOrUpdateFile = async (
      file: { id: string; name: string; mimeType: string; size?: string; webViewLink: string },
      categoryId: string | null,
      driveFolder: string | null,
    ) => {
      if (tombstonedDriveIds.has(file.id)) {
        skipped += 1;
        return;
      }

      seenDriveIds.add(file.id);
      const found = existingByDriveId.get(file.id);
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
          updated += 1;
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
          skipped += 1;
        } else {
          skipped += 1;
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
        imported += 1;
        existingByDriveId.set(file.id, {
          docId: inserted.id,
          currentDriveFolder: driveFolder,
          existingMetadata: { source: 'drive_sync' },
        });
      }
    };

    const safeListFiles = async (folderId: string) => {
      try {
        return await client.listFolderFilesPaginated(folderId);
      } catch {
        listingsComplete = false;
        return [];
      }
    };
    const safeListSubfolders = async (folderId: string) => {
      try {
        return await client.listSubfolders(folderId);
      } catch {
        listingsComplete = false;
        return [];
      }
    };

    // Scan subfolders dynamically (matches even if our cache is stale)
    const subfolders = await safeListSubfolders(drive.case_folder_id);
    for (const sub of subfolders) {
      const folderKey = NAME_TO_FOLDER_KEY[sub.name];
      if (!folderKey) continue;
      const categoryId = firstCategoryPerFolder.get(folderKey);
      if (!categoryId) continue;
      const files = await safeListFiles(sub.id);
      for (const f of files) {
        await importOrUpdateFile(f, categoryId, folderKey);
      }
    }

    // Files at the case-folder root → "uncategorized" (category_id = null)
    // The advisor categorizes them from the UI.
    const rootFiles = await safeListFiles(drive.case_folder_id);
    for (const f of rootFiles) {
      await importOrUpdateFile(f, null, null);
    }

    // Soft-delete docs whose Drive file vanished, with a grace period:
    //   first time missing → stamp metadata.drive_missing_since = now, keep row
    //   missing ≥ 48h     → soft-delete + clear the flag
    // If the file reappears (importOrUpdateFile handles the found-after-missing
    // case above), the flag is cleared and the clock resets.
    //
    // Only run if ALL list calls succeeded - otherwise a transient API hiccup
    // could mark healthy docs as missing.
    if (listingsComplete) {
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();

      for (const [driveId, entry] of existingByDriveId) {
        if (seenDriveIds.has(driveId)) continue;
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
        if (!error) deleted += 1;
      }
    }
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : 'unknown',
    };
  }

  await persistLastSyncedAt(caseId);
  return { ok: true, imported, updated, skipped, deleted };
}

export type { GoogleDriveClient };
