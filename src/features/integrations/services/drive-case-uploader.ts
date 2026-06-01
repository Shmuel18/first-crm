import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

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
  caseNumber: string;
  familyName: string;
  driveFolder: string; // identity | income_il | income_abroad | insurance_collateral
  file: { content: ArrayBuffer | Uint8Array; name: string; mimeType: string };
};

export type DriveCaseUploadOutcome =
  | { ok: true; driveFileId: string; webViewLink: string }
  | { ok: false; reason: 'not_connected' | 'no_subfolder_for_category' | 'error'; message?: string };

/** Returns a Drive client if google_drive is connected, else null. */
export async function getDriveClientIfConnected(): Promise<GoogleDriveClient | null> {
  const row = await getIntegration('google_drive');
  if (!row || row.status !== 'connected' || !row.refresh_token) return null;
  return new GoogleDriveClient(row);
}

async function getCaseDriveMeta(caseId: string): Promise<CaseDriveMeta> {
  const supabase = await createClient();
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
): Promise<void> {
  const supabase = await createClient();
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

async function ensureCaseFolder(
  client: GoogleDriveClient,
  rootId: string,
  caseId: string,
  caseNumber: string,
  familyName: string,
  meta: CaseDriveMeta,
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
      caseFolderName(caseNumber, familyName),
      rootId,
      { caseFolderId: caseId },
    );
  }

  const nowIso = new Date().toISOString();
  await patchCaseDriveMeta(caseId, {
    case_folder_id: id,
    last_synced_at: nowIso,
  });
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
  await patchCaseDriveMeta(caseId, { subfolders: newSubfolders });
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
    const meta = await getCaseDriveMeta(input.caseId);
    const rootId = await ensureRootFolder(client);
    const caseFolderId = await ensureCaseFolder(
      client,
      rootId,
      input.caseId,
      input.caseNumber,
      input.familyName,
      meta,
    );
    const subfolderId = await ensureSubfolder(
      client,
      input.caseId,
      caseFolderId,
      input.driveFolder,
      meta,
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
  caseNumber: string;
  familyName: string;
}): Promise<void> {
  const client = await getDriveClientIfConnected();
  if (!client) return;
  try {
    const meta = await getCaseDriveMeta(input.caseId);
    const rootId = await ensureRootFolder(client);
    const caseFolderId = await ensureCaseFolder(
      client,
      rootId,
      input.caseId,
      input.caseNumber,
      input.familyName,
      meta,
    );
    for (const folder of Object.keys(DRIVE_SUBFOLDER_NAMES)) {
      await ensureSubfolder(client, input.caseId, caseFolderId, folder, meta);
    }
  } catch (err) {
    console.error('[provisionCaseDriveFolders] best-effort provision failed', {
      caseId: input.caseId,
      message: err instanceof Error ? err.message : 'unknown',
    });
  }
}

/** Best-effort delete from Drive. Never throws. */
export async function deleteCaseDocumentFromDrive(driveFileId: string): Promise<void> {
  const client = await getDriveClientIfConnected();
  if (!client) return;
  await client.deleteFile(driveFileId).catch(() => undefined);
}
