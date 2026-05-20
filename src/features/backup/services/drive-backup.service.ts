import type { GoogleDriveClient } from '@/features/integrations/services/google-drive';

import type { BackupFileMeta } from '../types';

const BACKUP_FOLDER_NAME = 'KFG_Backups';
const BACKUP_MIME = 'application/json';

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
  json: string,
): Promise<{ id: string; webViewLink: string }> {
  return client.uploadFile({
    content: new TextEncoder().encode(json),
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
  return files
    .filter((f) => f.name.endsWith('.json'))
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
  return `kaufman-backup-${stamp}.json`;
}
