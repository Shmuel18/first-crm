'use server';

import { revalidatePath } from 'next/cache';

import { getDriveClientIfConnected } from '@/features/integrations/services/drive-case-uploader';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { encryptWithKey, encryptWithKeyV2 } from '@/lib/crypto/secrets';
import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

import { buildBackupSnapshot } from '../services/backup-snapshot.service';
import {
  backupFilename,
  ensureBackupFolder,
  uploadBackup,
} from '../services/drive-backup.service';

import type { RunBackupResult } from '../types';

export async function runBackupAction(): Promise<RunBackupResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  // Backups scan every business table and upload to Drive — the nightly cron
  // already does this once per day. A manual button-mash shouldn't trigger
  // more than 1 every 10 minutes. The cron route does not call this action,
  // so its own throttling is not affected by this counter.
  const allowed = await checkRateLimit({
    action: 'run_backup',
    subject: `user:${userRes.user.id}`,
    max: 1,
    windowSeconds: 600,
  });
  if (!allowed) return { ok: false, error: 'rate_limited' };

  const client = await getDriveClientIfConnected();
  if (!client) return { ok: false, error: 'not_connected' };

  try {
    const { data, counts } = await buildBackupSnapshot();
    const totalRows = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const json = JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      counts,
      data,
    });
    // Encrypt before upload. The snapshot contains borrower PII and
    // manager-only financials — anyone with Drive access would read them
    // otherwise. AES-256-GCM via lib/crypto/secrets with a dedicated key.
    // v2 (per-deployment salt) is preferred when BACKUP_ENCRYPTION_SALT_V2
    // is set; falls back to v1 (code-baked salt) otherwise. Restore reads
    // both via prefix detection.
    const payload = env.BACKUP_ENCRYPTION_SALT_V2
      ? encryptWithKeyV2(json, env.BACKUP_ENCRYPTION_KEY, env.BACKUP_ENCRYPTION_SALT_V2)
      : encryptWithKey(json, env.BACKUP_ENCRYPTION_KEY);

    const folderId = await ensureBackupFolder(client);
    const filename = backupFilename();
    const result = await uploadBackup(client, folderId, filename, payload);

    revalidatePath('/settings/backup');
    return { ok: true, filename, webViewLink: result.webViewLink, totalRows };
  } catch (err) {
    console.error('runBackupAction failed', err);
    return { ok: false, error: 'unknown' };
  }
}
