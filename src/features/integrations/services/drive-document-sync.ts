import { createClient } from '@/lib/supabase/server';

import { DRIVE_SUBFOLDER_NAMES, type GoogleDriveClient } from './google-drive';
import { getDriveClientIfConnected } from './drive-case-uploader';

type CaseDriveMeta = {
  case_folder_id?: string;
  subfolders?: Partial<Record<string, string>>;
  last_synced_at?: string;
};

/** Auto-sync on page load only if last sync was older than this. */
const MIN_AUTO_SYNC_INTERVAL_MS = 10_000;

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

  await syncDriveDocumentsForCase(caseId).catch(() => undefined);
}

async function persistLastSyncedAt(caseId: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.from('cases').select('metadata').eq('id', caseId).maybeSingle();
  const current =
    data?.metadata && typeof data.metadata === 'object'
      ? (data.metadata as Record<string, unknown>)
      : {};
  const drive =
    current.drive && typeof current.drive === 'object'
      ? (current.drive as Record<string, unknown>)
      : {};
  await supabase
    .from('cases')
    .update({
      metadata: { ...current, drive: { ...drive, last_synced_at: new Date().toISOString() } },
    })
    .eq('id', caseId);
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
    .select('id, drive_file_id, category:category_id(drive_folder)')
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .not('drive_file_id', 'is', null);

  const existingByDriveId = new Map<
    string,
    { docId: string; currentDriveFolder: string | null }
  >();
  for (const e of existing ?? []) {
    if (!e.drive_file_id) continue;
    const cat = e.category as { drive_folder?: string } | null;
    existingByDriveId.set(e.drive_file_id, {
      docId: e.id,
      currentDriveFolder: cat?.drive_folder ?? null,
    });
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let deleted = 0;
  // Track which existing drive_file_ids we actually saw this pass - the
  // unseen ones were deleted from Drive (or moved out of our folders).
  const seenDriveIds = new Set<string>();

  try {
    const importOrUpdateFile = async (
      file: { id: string; name: string; mimeType: string; size?: string; webViewLink: string },
      categoryId: string | null,
      driveFolder: string | null,
    ) => {
      seenDriveIds.add(file.id);
      const found = existingByDriveId.get(file.id);
      if (found) {
        // File already known - detect any move (between subfolders OR to/from root)
        if (found.currentDriveFolder !== driveFolder) {
          await supabase
            .from('documents')
            .update({
              category_id: categoryId,
              metadata: { source: 'drive_sync' },
            })
            .eq('id', found.docId);
          updated += 1;
          found.currentDriveFolder = driveFolder;
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
        // Track the inserted docId so a second sight of the same file_id
        // (e.g. via shortcuts or shared files) updates the right row.
        existingByDriveId.set(file.id, {
          docId: inserted.id,
          currentDriveFolder: driveFolder,
        });
      }
    };

    // Scan subfolders dynamically (matches even if our cache is stale)
    const subfolders = await client.listSubfolders(drive.case_folder_id);
    for (const sub of subfolders) {
      const folderKey = NAME_TO_FOLDER_KEY[sub.name];
      if (!folderKey) continue;
      const categoryId = firstCategoryPerFolder.get(folderKey);
      if (!categoryId) continue;
      const files = await client.listFolderFiles(sub.id);
      for (const f of files) {
        await importOrUpdateFile(f, categoryId, folderKey);
      }
    }

    // Files at the case-folder root → "uncategorized" (category_id = null)
    // The advisor categorizes them from the UI.
    const rootFiles = await client.listFolderFiles(drive.case_folder_id);
    for (const f of rootFiles) {
      await importOrUpdateFile(f, null, null);
    }

    // Soft-delete docs whose Drive file vanished (deleted or moved outside
    // our case folder hierarchy). The blob may still be in Supabase Storage
    // but the doc record is hidden from the UI.
    for (const [driveId, entry] of existingByDriveId) {
      if (seenDriveIds.has(driveId)) continue;
      if (!entry.docId) continue;
      const { error } = await supabase
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', entry.docId);
      if (!error) deleted += 1;
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
