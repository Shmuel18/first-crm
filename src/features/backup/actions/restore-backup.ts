'use server';

import { revalidatePath } from 'next/cache';

import { getDriveClientIfConnected } from '@/features/integrations/services/drive-case-uploader';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { decryptWithKey } from '@/lib/crypto/secrets';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

import { BackupSnapshotSchema } from '../schemas/snapshot.schema';
import { restoreSnapshot } from '../services/restore.service';

import type { RestoreBackupResult } from '../types';

const MAX_BYTES = 20 * 1024 * 1024;
// Restore handles both legacy v1 and the new v2 (per-deploy salt) backups.
// Prefix detection routes to the right key derivation inside decryptWithKey.
const ENC_PREFIX_V1 = 'enc:v1:';
const ENC_PREFIX_V2 = 'enc:v2:';
const isEncrypted = (s: string): boolean =>
  s.startsWith(ENC_PREFIX_V1) || s.startsWith(ENC_PREFIX_V2);

export async function restoreBackupAction(driveFileId: string): Promise<RestoreBackupResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };
  if (typeof driveFileId !== 'string' || driveFileId.length === 0 || driveFileId.length > 200) {
    return { ok: false, error: 'validation' };
  }

  const client = await getDriveClientIfConnected();
  if (!client) return { ok: false, error: 'not_connected' };

  try {
    const text = await client.downloadFileText(driveFileId);
    if (text.length > MAX_BYTES) return { ok: false, error: 'too_large' };

    // New backups are encrypted (enc:v1: prefix). Legacy backups created
    // before encryption shipped are plain JSON; they round-trip through
    // decryptWithKey unchanged when BACKUP_ENCRYPTION_STRICT=false.
    // When strict=true, plaintext files throw and the restore is refused —
    // closes the "malicious admin uploads a hand-crafted plaintext backup"
    // vector once you've confirmed all legitimate backups are encrypted.
    // A tampered or wrong-key file throws on GCM auth-tag verification.
    let plaintext: string;
    try {
      if (isEncrypted(text)) {
        plaintext = decryptWithKey(text, env.BACKUP_ENCRYPTION_KEY, {
          strict: env.BACKUP_ENCRYPTION_STRICT,
          saltV2: env.BACKUP_ENCRYPTION_SALT_V2,
        });
      } else if (env.NODE_ENV === 'production' || env.BACKUP_ENCRYPTION_STRICT) {
        console.error('[restoreBackup] refusing plaintext backup (strict mode)', {
          driveFileId,
        });
        return { ok: false, error: 'invalid_file' };
      } else {
        plaintext = text;
      }
    } catch {
      return { ok: false, error: 'invalid_file' };
    }

    let raw: unknown;
    try {
      raw = JSON.parse(plaintext);
    } catch {
      return { ok: false, error: 'invalid_file' };
    }

    const parsed = BackupSnapshotSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: 'invalid_file' };

    const counts = await restoreSnapshot(parsed.data);
    const restored = Object.values(counts).reduce((sum, n) => sum + n, 0);

    revalidatePath('/settings/backup');
    return { ok: true, restored };
  } catch (err) {
    console.error('restoreBackupAction failed', err);
    return { ok: false, error: 'unknown' };
  }
}
