import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { formatPersonName } from '@/lib/utils/person-name';
import type { Database, Json } from '@/types/database';

import {
  DRIVE_SUBFOLDER_NAMES,
  GoogleDriveClient,
  caseFolderName,
  type DriveUploadResult,
} from './google-drive';
import { getIntegration, persistDriveRootFolderId } from './integrations.service';

type CaseDriveMeta = {
  case_folder_id?: string;
  subfolders?: Partial<Record<string, string>>;
  last_synced_at?: string;
};

export type DriveCaseUploadInput = {
  caseId: string;
  driveFolder: string; // identity | income_il | income_abroad | insurance_collateral
  file: { content: ArrayBuffer | Uint8Array; name: string; mimeType: string };
};

/**
 * Which Supabase client the Drive metadata reads/writes go through. Callers
 * inside a request use the session client (RLS applies); the one-shot backfill
 * route runs over the whole portfolio with the service-role client.
 */
type DriveDb = SupabaseClient<Database>;

async function driveDb(admin: boolean): Promise<DriveDb> {
  return admin ? createAdminClient() : await createClient();
}

export type DriveCaseUploadOutcome =
  | { ok: true; driveFileId: string; webViewLink: string }
  | { ok: false; reason: 'not_connected' | 'no_subfolder_for_category' | 'error'; message?: string };

/** Returns a Drive client if google_drive is connected, else null. */
export async function getDriveClientIfConnected(): Promise<GoogleDriveClient | null> {
  const row = await getIntegration('google_drive');
  if (!row || row.status !== 'connected' || !row.refresh_token) return null;
  return new GoogleDriveClient(row);
}

async function getCaseDriveMeta(caseId: string, supabase: DriveDb): Promise<CaseDriveMeta> {
  const { data, error } = await supabase
    .from('cases')
    .select('metadata')
    .eq('id', caseId)
    .maybeSingle();
  if (error || !data) return {};
  const meta = data.metadata;
  if (meta && typeof meta === 'object' && 'drive' in meta) {
    return (meta as { drive: CaseDriveMeta }).drive ?? {};
  }
  return {};
}

/**
 * Patch the case.metadata.drive subtree atomically via update_case_drive_meta
 * RPC (migration 026). Concurrent calls serialize at the row lock; missing
 * keys in the patch are preserved instead of being wiped by a stale read.
 */
async function patchCaseDriveMeta(
  caseId: string,
  patch: Partial<CaseDriveMeta>,
  supabase: DriveDb,
): Promise<void> {
  await supabase.rpc('update_case_drive_meta', {
    p_case_id: caseId,
    // Partial<CaseDriveMeta> is JSON-shaped; widen at the call boundary.
    p_patch: patch as unknown as Json,
  });
}

async function ensureRootFolder(client: GoogleDriveClient): Promise<string> {
  const integration = await getIntegration('google_drive');
  const rootName = integration?.drive_root_folder_name ?? 'KFG_Cases';
  if (integration?.drive_root_folder_id) return integration.drive_root_folder_id;
  const id = await client.ensureFolder(rootName);
  await persistDriveRootFolderId(id);
  return id;
}

/**
 * The case's Drive folder name: the client's name, exactly as the app shows it
 * (family-name-first, borrowers joined by " & "). Resolved here — and only when
 * a folder actually has to be created — so every caller produces the same name
 * without threading it through the upload API. Falls back to "Case" for a case
 * with no readable borrower.
 */
export async function resolveCaseClientName(
  caseId: string,
  supabase: DriveDb,
): Promise<string> {
  const { data } = await supabase
    .from('case_borrowers')
    .select('is_primary, borrower:borrowers(first_name, last_name, deleted_at)')
    .eq('case_id', caseId)
    .order('is_primary', { ascending: false });

  const names = (data ?? [])
    .map((row) => (Array.isArray(row.borrower) ? row.borrower[0] : row.borrower))
    .filter((b) => b != null && b.deleted_at === null)
    .map((b) => formatPersonName(b?.first_name, b?.last_name))
    .filter(Boolean);

  return names.join(' & ') || 'Case';
}

async function ensureCaseFolder(
  client: GoogleDriveClient,
  rootId: string,
  caseId: string,
  meta: CaseDriveMeta,
  supabase: DriveDb,
): Promise<string> {
  if (meta.case_folder_id) return meta.case_folder_id;

  // Look up by a stable appProperty (caseFolderId = our case UUID) instead
  // of by display name. This protects against (a) the user renaming the
  // folder in Drive, (b) folder-name conflicts inside the office's Drive,
  // and (c) most of the duplicate-folder race window when two concurrent
  // uploads first land for a freshly-created case. (A pure Drive-side
  // mutex would close the rest; tracked as a follow-up.)
  let id = await client.findFolderByAppProperty('caseFolderId', caseId, rootId);
  if (!id) {
    id = await client.createFolder(
      caseFolderName(await resolveCaseClientName(caseId, supabase)),
      rootId,
      { caseFolderId: caseId },
    );
  }

  const nowIso = new Date().toISOString();
  await patchCaseDriveMeta(caseId, {
    case_folder_id: id,
    last_synced_at: nowIso,
  }, supabase);
  meta.case_folder_id = id;
  meta.last_synced_at = nowIso;
  return id;
}

async function ensureSubfolder(
  client: GoogleDriveClient,
  caseId: string,
  caseFolderId: string,
  driveFolder: string,
  meta: CaseDriveMeta,
  supabase: DriveDb,
): Promise<string | null> {
  const folderName = DRIVE_SUBFOLDER_NAMES[driveFolder];
  if (!folderName) return null;
  const cached = meta.subfolders?.[driveFolder];
  if (cached) return cached;
  const id = await client.ensureFolder(folderName, caseFolderId);
  const newSubfolders = { ...(meta.subfolders ?? {}), [driveFolder]: id };
  // Note: this still has a small race vs another writer adding a different
  // subfolder key at the same instant (we're sending the whole subfolders
  // object). True per-key merge needs a deeper RPC; deferred since the
  // realistic concurrency for sub-folder creation is very low.
  await patchCaseDriveMeta(caseId, { subfolders: newSubfolders }, supabase);
  meta.subfolders = newSubfolders;
  return id;
}

/**
 * Best-effort: upload a case document file to Drive in the correct folder.
 * Returns ok=false with a reason if Drive isn't connected or upload fails
 * - callers should treat Drive as a *secondary* store, never blocking on it.
 */
export async function uploadCaseDocumentToDrive(
  input: DriveCaseUploadInput,
): Promise<DriveCaseUploadOutcome> {
  const client = await getDriveClientIfConnected();
  if (!client) return { ok: false, reason: 'not_connected' };

  try {
    const supabase = await driveDb(false);
    const meta = await getCaseDriveMeta(input.caseId, supabase);
    const rootId = await ensureRootFolder(client);
    const caseFolderId = await ensureCaseFolder(
      client,
      rootId,
      input.caseId,
      meta,
      supabase,
    );
    const subfolderId = await ensureSubfolder(
      client,
      input.caseId,
      caseFolderId,
      input.driveFolder,
      meta,
      supabase,
    );
    if (!subfolderId) return { ok: false, reason: 'no_subfolder_for_category' };

    const result: DriveUploadResult = await client.uploadFile({
      ...input.file,
      parentId: subfolderId,
    });
    return { ok: true, driveFileId: result.id, webViewLink: result.webViewLink };
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : 'unknown',
    };
  }
}

/**
 * Best-effort: ensure the case's Drive folder + every category subfolder exist
 * (creating them if missing) and persist the folder id. No-ops when Drive isn't
 * connected, and never throws. Idempotent — ensureCaseFolder/ensureSubfolder
 * short-circuit on the cached ids, so a repeat call costs nothing Drive-side.
 * Lets a case's "open in Drive" + sync work without waiting for a first upload,
 * and gives the office an empty folder tree to drop existing files into.
 */
export async function provisionCaseDriveFolders(input: {
  caseId: string;
  /** Service-role path — for the one-shot backfill, which runs outside any
   *  user session and must reach every case in the portfolio. */
  admin?: boolean;
}): Promise<void> {
  const client = await getDriveClientIfConnected();
  if (!client) return;
  try {
    const supabase = await driveDb(input.admin === true);
    const meta = await getCaseDriveMeta(input.caseId, supabase);
    const rootId = await ensureRootFolder(client);
    const caseFolderId = await ensureCaseFolder(
      client,
      rootId,
      input.caseId,
      meta,
      supabase,
    );
    for (const folder of Object.keys(DRIVE_SUBFOLDER_NAMES)) {
      await ensureSubfolder(client, input.caseId, caseFolderId, folder, meta, supabase);
    }
  } catch (err) {
    console.error('[provisionCaseDriveFolders] best-effort provision failed', {
      caseId: input.caseId,
      message: err instanceof Error ? err.message : 'unknown',
    });
  }
}

/**
 * Rename an already-provisioned case folder to the current naming convention
 * (the client's name). Only touches a folder we created and still track, only
 * when the name actually differs, and never moves it or its contents — so
 * whatever the office has already filed inside stays put.
 *
 * Returns 'renamed' | 'ok' (already correct) | 'skipped' (no folder tracked,
 * or the folder is gone from Drive) | 'error'.
 */
export async function renameCaseDriveFolder(input: {
  caseId: string;
  admin?: boolean;
}): Promise<'renamed' | 'ok' | 'skipped' | 'error'> {
  const client = await getDriveClientIfConnected();
  if (!client) return 'skipped';
  try {
    const supabase = await driveDb(input.admin === true);
    const meta = await getCaseDriveMeta(input.caseId, supabase);
    if (!meta.case_folder_id) return 'skipped';

    const current = await client.getFileName(meta.case_folder_id);
    if (current === null) return 'skipped';

    const desired = caseFolderName(await resolveCaseClientName(input.caseId, supabase));
    if (current === desired) return 'ok';

    await client.renameFile(meta.case_folder_id, desired);
    return 'renamed';
  } catch (err) {
    console.error('[renameCaseDriveFolder] rename failed', {
      caseId: input.caseId,
      message: err instanceof Error ? err.message : 'unknown',
    });
    return 'error';
  }
}

/**
 * Best-effort erase of Drive targets — a case folder and/or individual files.
 * Resolves the Drive client ONCE (avoids re-auth per id) and reports which ids
 * were actually deleted, so callers can clear their stored references only for
 * confirmed deletions. A 404 counts as deleted (already gone). Never throws.
 * Deleting a case folder also removes every file inside it in one call.
 */
export async function eraseDriveTargets(targets: {
  folderId?: string | null;
  fileIds: string[];
}): Promise<{ connected: boolean; deleted: string[]; failed: string[] }> {
  const client = await getDriveClientIfConnected();
  if (!client) return { connected: false, deleted: [], failed: [] };

  const ids = [...(targets.folderId ? [targets.folderId] : []), ...targets.fileIds];
  const deleted: string[] = [];
  const failed: string[] = [];
  for (const id of ids) {
    try {
      await client.deleteFile(id);
      deleted.push(id);
    } catch {
      failed.push(id);
    }
  }
  return { connected: true, deleted, failed };
}
