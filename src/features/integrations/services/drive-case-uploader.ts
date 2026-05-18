import { createClient } from '@/lib/supabase/server';

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

async function persistCaseDriveMeta(caseId: string, drive: CaseDriveMeta): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.from('cases').select('metadata').eq('id', caseId).maybeSingle();
  const current =
    data?.metadata && typeof data.metadata === 'object' ? (data.metadata as Record<string, unknown>) : {};
  await supabase
    .from('cases')
    .update({ metadata: { ...current, drive } })
    .eq('id', caseId);
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
  const id = await client.ensureFolder(caseFolderName(caseNumber, familyName), rootId);
  meta.case_folder_id = id;
  await persistCaseDriveMeta(caseId, meta);
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
  meta.subfolders = { ...(meta.subfolders ?? {}), [driveFolder]: id };
  await persistCaseDriveMeta(caseId, meta);
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

/** Best-effort delete from Drive. Never throws. */
export async function deleteCaseDocumentFromDrive(driveFileId: string): Promise<void> {
  const client = await getDriveClientIfConnected();
  if (!client) return;
  await client.deleteFile(driveFileId).catch(() => undefined);
}
