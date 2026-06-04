import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { recordBackupSuccess } from '@/features/backup/services/backup-freshness.service';
import { buildBackupSnapshot } from '@/features/backup/services/backup-snapshot.service';
import {
  backupFilename,
  ensureBackupFolder,
  uploadBackup,
} from '@/features/backup/services/drive-backup.service';
import { getDriveClientIfConnected } from '@/features/integrations/services/drive-case-uploader';
import { decryptWithKey, encryptWithKey, encryptWithKeyV2 } from '@/lib/crypto/secrets';
import { env } from '@/lib/env';

/** Vercel Pro function cap. The backup serializes + encrypts + uploads every
 *  business table; allow the maximum so a single slow Drive hop doesn't fail
 *  the nightly run. Scope this UP if you've moved to streaming. */
export const maxDuration = 60;

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
  const provided = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const client = await getDriveClientIfConnected();
  if (!client) {
    console.warn('[cron/backup] skipped: Drive is not connected');
    return NextResponse.json({ ok: false, error: 'drive_not_connected' }, { status: 503 });
  }

  try {
    const { data, counts } = await buildBackupSnapshot();
    const totalRows = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const json = JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      counts,
      data,
    });
    // Mirror runBackupAction: encrypt the snapshot before upload so Drive
    // alone can't read PII / manager-only fields. v2 (per-deploy salt)
    // when BACKUP_ENCRYPTION_SALT_V2 is set, v1 otherwise.
    const payload = env.BACKUP_ENCRYPTION_SALT_V2
      ? encryptWithKeyV2(json, env.BACKUP_ENCRYPTION_KEY, env.BACKUP_ENCRYPTION_SALT_V2)
      : encryptWithKey(json, env.BACKUP_ENCRYPTION_KEY);
    const folderId = await ensureBackupFolder(client);
    const filename = backupFilename();
    const { id } = await uploadBackup(client, folderId, filename, payload);

    // Read-back verification: a backup we can't decrypt is worse than none —
    // it looks like success until restore day. Download what we just wrote and
    // confirm it round-trips byte-for-byte under the current key/salt.
    const roundTrip = await client.downloadFileText(id);
    const decrypted = decryptWithKey(roundTrip, env.BACKUP_ENCRYPTION_KEY, {
      saltV2: env.BACKUP_ENCRYPTION_SALT_V2,
    });
    if (decrypted !== json) {
      console.error('[cron/backup] read-back verification failed', { filename });
      return NextResponse.json({ ok: false, error: 'verify_failed' }, { status: 500 });
    }
    // SRE-2: stamp the verified success so the staleness watchdog + Settings
    // card know a real backup happened. Best-effort — never fail a good backup.
    await recordBackupSuccess();
    return NextResponse.json({ ok: true, filename, totalRows, verified: true });
  } catch (err) {
    console.error('[cron/backup] failed', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    // Return a generic error to whoever is hitting this — even though
    // CRON_SECRET gates the route, the same hygiene rule applies as for
    // user-facing actions: don't echo DB/RPC internals.
    return NextResponse.json({ ok: false, error: 'backup_failed' }, { status: 500 });
  }
}
