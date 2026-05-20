import { NextResponse } from 'next/server';

import { buildBackupSnapshot } from '@/features/backup/services/backup-snapshot.service';
import {
  backupFilename,
  ensureBackupFolder,
  uploadBackup,
} from '@/features/backup/services/drive-backup.service';
import { getDriveClientIfConnected } from '@/features/integrations/services/drive-case-uploader';
import { env } from '@/lib/env';

/**
 * Nightly automated backup to Drive (Vercel Cron — see vercel.json).
 * No user session: the snapshot reads via the service-role client and the
 * office Drive token is server-only. Gated by CRON_SECRET (Vercel sends it as
 * `Authorization: Bearer <CRON_SECRET>`); when the secret is unset the route
 * refuses to run so it can't be triggered by anyone.
 */
export async function GET(request: Request): Promise<Response> {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const client = await getDriveClientIfConnected();
  if (!client) {
    return NextResponse.json({ ok: false, skipped: 'drive_not_connected' });
  }

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
    await uploadBackup(client, folderId, filename, payload);
    return NextResponse.json({ ok: true, filename, totalRows });
  } catch (err) {
    console.error('nightly backup failed', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
