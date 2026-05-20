'use server';

import { revalidatePath } from 'next/cache';

import { getDriveClientIfConnected } from '@/features/integrations/services/drive-case-uploader';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';
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

  const client = await getDriveClientIfConnected();
  if (!client) return { ok: false, error: 'not_connected' };

  try {
    const { data, counts } = await buildBackupSnapshot();
    const totalRows = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const payload = JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      counts,
      data,
    });

    const folderId = await ensureBackupFolder(client);
    const filename = backupFilename();
    const result = await uploadBackup(client, folderId, filename, payload);

    revalidatePath('/settings/backup');
    return { ok: true, filename, webViewLink: result.webViewLink, totalRows };
  } catch (err) {
    console.error('runBackupAction failed', err);
    return {
      ok: false,
      error: 'unknown',
      message: err instanceof Error ? err.message : 'unknown',
    };
  }
}
