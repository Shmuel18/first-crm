import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import {
  getDriveClientIfConnected,
  provisionCaseDriveFolders,
} from '@/features/integrations/services/drive-case-uploader';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 300;

/** Cases per invocation. Each one costs a handful of Drive API calls (folder
 *  lookup + up to 6 creates), so the batch is sized to finish well inside
 *  maxDuration. Re-run until `remaining` comes back 0. */
const BATCH_SIZE = 25;

/**
 * One-shot backfill: give every existing, non-deleted case the same central
 * Drive folder tree that new cases now get at save time. Idempotent — a case
 * that already has metadata.drive.case_folder_id is skipped, so re-running is
 * free and safe.
 *
 * Manual (not on a cron schedule), protected by CRON_SECRET like the other
 * maintenance routes:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/backfill-drive-folders
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

  // Fail loudly rather than silently "succeeding" on 80 no-ops: without a
  // connected Drive integration there is nothing to provision.
  if (!(await getDriveClientIfConnected())) {
    return NextResponse.json({ ok: false, error: 'drive_not_connected' }, { status: 409 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('cases')
    .select('id, metadata')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.error('[cron/backfill-drive-folders] case listing failed', { error });
    return NextResponse.json({ ok: false, error: 'unknown' }, { status: 500 });
  }

  const pending = data.filter((row) => {
    const meta = row.metadata;
    if (!meta || typeof meta !== 'object' || !('drive' in meta)) return true;
    const drive = (meta as { drive?: { case_folder_id?: string } }).drive;
    return !drive?.case_folder_id;
  });

  const batch = pending.slice(0, BATCH_SIZE);
  // Sequential on purpose: parallel provisioning of the same root folder
  // multiplies the duplicate-folder race the appProperty lookup only mostly
  // closes, and Drive rate-limits bursts anyway.
  for (const row of batch) {
    await provisionCaseDriveFolders({ caseId: row.id, admin: true });
  }

  const remaining = pending.length - batch.length;
  console.info('[cron/backfill-drive-folders] batch done', {
    total: data.length,
    provisioned: batch.length,
    remaining,
  });
  return NextResponse.json({ ok: true, provisioned: batch.length, remaining });
}
