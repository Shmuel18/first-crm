import type { GoogleDriveClient } from '@/features/integrations/services/google-drive';

import type { BackupFileMeta } from '../types';

const BACKUP_FOLDER_NAME = 'KFG_Backups';
// Encrypted backup files are application/octet-stream — the content is the
// `enc:v1:<base64>` envelope, not JSON. Drive doesn't care about the MIME for
// download purposes, but using the right type avoids the Drive UI offering a
// "preview" that shows ciphertext.
const BACKUP_MIME = 'application/octet-stream';
const BACKUP_EXTENSION = '.kfg-backup';

/** Find the backups folder without creating it (for read-only page loads). */
export async function findBackupFolder(client: GoogleDriveClient): Promise<string | null> {
  return client.findFolder(BACKUP_FOLDER_NAME);
}

/** Find-or-create the backups folder (used when actually writing a backup). */
export async function ensureBackupFolder(client: GoogleDriveClient): Promise<string> {
  return client.ensureFolder(BACKUP_FOLDER_NAME);
}

export async function uploadBackup(
  client: GoogleDriveClient,
  folderId: string,
  filename: string,
  payload: string,
): Promise<{ id: string; webViewLink: string }> {
  return client.uploadFile({
    content: new TextEncoder().encode(payload),
    name: filename,
    mimeType: BACKUP_MIME,
    parentId: folderId,
  });
}

export async function listBackups(
  client: GoogleDriveClient,
  folderId: string,
): Promise<BackupFileMeta[]> {
  const files = await client.listFolderFiles(folderId);
  // Accept both the encrypted suffix (current) and legacy .json files (any
  // backups created before encryption shipped) — restore handles both.
  return files
    .filter((f) => f.name.endsWith(BACKUP_EXTENSION) || f.name.endsWith('.json'))
    .sort((a, b) => b.createdTime.localeCompare(a.createdTime))
    .map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size ? Number(f.size) : null,
      webViewLink: f.webViewLink,
      createdTime: f.createdTime,
    }));
}

export function backupFilename(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}`;
  return `kaufman-backup-${stamp}${BACKUP_EXTENSION}`;
}
