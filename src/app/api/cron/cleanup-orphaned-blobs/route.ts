import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { recordErasureSuccess } from '@/features/documents/services/erasure-freshness.service';
import { eraseRetiredFiles } from '@/features/documents/services/retention-file-eraser';
import { env } from '@/lib/env';

/**
 * Daily LEGAL-3 erasure of Storage blobs + Google Drive copies for retired
 * documents AND expense receipts. This route is the ONLY place that can reach
 * the Storage + Drive APIs (pg_cron / SQL cannot), so it erases the files and
 * nulls the pointers; the SQL purge (cleanup_soft_deleted_records, migration
 * 139) finalizes a row only once BOTH its Storage AND Drive pointers are gone —
 * or past the retention backstop, which force-finalizes so a disconnected Drive
 * (or a missing blob) can't retain a row forever. Bounded retention, no orphan.
 *
 * All logic lives in eraseRetiredFiles() (retention-file-eraser.ts) — covers
 * directly-soft-deleted AND cascade-doomed rows, filtered to file-bearing rows
 * + ordered for guaranteed forward progress, on the configured retention
 * window. Same CRON_SECRET gating as the backup route.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 });
  }
  const provided = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const result = await eraseRetiredFiles();
  if (!result.ok) {
    console.error('[cron/cleanup-blobs] erase failed', { error: result.error });
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  // Retention purge paused (mig 173): nothing was erased, so do NOT stamp a
  // success — the watchdog is independently switch-aware and stays quiet.
  if ('paused' in result) {
    return NextResponse.json({ ok: true, paused: true });
  }
  // Stamp success so erasure-watchdog can detect a silently-dead eraser. A 0-file
  // run still counts — it proves the cron fired and the eraser did not error.
  // Best-effort: a stamp failure must not fail an otherwise-successful erasure.
  await recordErasureSuccess();
  return NextResponse.json(result);
}
