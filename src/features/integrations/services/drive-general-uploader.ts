import { getDriveClientIfConnected } from './drive-case-uploader';

/**
 * Standalone Drive folder for general / office documents. Lives at the Drive
 * root, a SIBLING of the per-case `KFG_Cases` tree, so office files never mix
 * into client folders. All general files sit flat inside this one folder.
 */
const GENERAL_DRIVE_FOLDER_NAME = 'מסמכים כלליים';

export type DriveGeneralUploadOutcome =
  | { ok: true; driveFileId: string; webViewLink: string }
  | { ok: false; reason: 'not_connected' | 'error'; message?: string };

/**
 * Best-effort: upload a general (case-less) task file to the standalone general
 * folder. Drive is a secondary store — callers must never block on it.
 *
 * Note: the folder is resolved by name via ensureFolder (find-or-create). Under
 * heavy first-use concurrency two folders could briefly be created; acceptable
 * for the office's low volume. Persist the id if that ever becomes a problem.
 */
export async function uploadGeneralDocumentToDrive(input: {
  file: { content: ArrayBuffer | Uint8Array; name: string; mimeType: string };
}): Promise<DriveGeneralUploadOutcome> {
  const client = await getDriveClientIfConnected();
  if (!client) return { ok: false, reason: 'not_connected' };

  try {
    const folderId = await client.ensureFolder(GENERAL_DRIVE_FOLDER_NAME);
    const result = await client.uploadFile({ ...input.file, parentId: folderId });
    return { ok: true, driveFileId: result.id, webViewLink: result.webViewLink };
  } catch (err) {
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : 'unknown' };
  }
}
