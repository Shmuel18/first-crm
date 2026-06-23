import { decryptWithKey } from '@/lib/crypto/secrets';
import { env } from '@/lib/env';

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

// Drive is occasionally not-yet-consistent in the moment right after an upload
// (the new file briefly 404s or returns stale/empty bytes). A single read-back
// would fail an otherwise-good backup and leave the run unstamped — exactly the
// transient miss the nightly cron hit. Retry a few times before giving up.
const READBACK_DELAYS_MS = [0, 1000, 2500];

/**
 * Confirm a just-uploaded backup round-trips byte-for-byte under the current
 * key/salt. Returns true ONLY on an exact match; retries transient read-back
 * failures (thrown errors or content mismatch) across READBACK_DELAYS_MS first.
 * An unverifiable backup is worse than an obvious failure — callers must never
 * stamp success on a false return.
 */
export async function verifyBackupReadBack(
  client: GoogleDriveClient,
  fileId: string,
  expectedJson: string,
): Promise<boolean> {
  let lastIssue = 'no attempt made';
  for (const delayMs of READBACK_DELAYS_MS) {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      const roundTrip = await client.downloadFileText(fileId);
      const decrypted = decryptWithKey(roundTrip, env.BACKUP_ENCRYPTION_KEY, {
        saltV2: env.BACKUP_ENCRYPTION_SALT_V2,
      });
      if (decrypted === expectedJson) return true;
      lastIssue = 'content mismatch';
    } catch (err) {
      lastIssue = err instanceof Error ? err.message : 'download/decrypt threw';
    }
  }
  console.error('[backup] read-back verification failed after retries', { fileId, lastIssue });
  return false;
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
