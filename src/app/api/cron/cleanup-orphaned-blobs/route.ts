import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import type { Json } from '@/types/database';

/**
 * Daily cleanup of orphaned Storage blobs whose document was soft-deleted
 * ≥ 30 days ago. `deleteDocumentAction` flips `deleted_at` on the row but
 * intentionally leaves the blob alone so an accidental delete can be
 * restored within the grace window. After 30 days the blob is dead weight
 * — Supabase Storage bills per-GB regardless of whether the bytes are
 * still referenced.
 *
 * Flow:
 *   1. SELECT documents WHERE deleted_at < now() - 30d AND metadata has
 *      storage_path. Service-role read so RLS doesn't hide soft-deleted rows.
 *   2. For each batch: storage.remove([paths]) — Supabase accepts up to
 *      1000 paths per call.
 *   3. Strip metadata.storage_path so we don't re-process if the cron
 *      retries on a partial failure.
 *
 * Why a Route Handler instead of an RPC: storage.remove() lives in the
 * Storage API, not the SQL engine. pg_cron can't reach it directly. The
 * Vercel cron pulls the rows + calls Storage in one place, with the same
 * CRON_SECRET gating as the backup route.
 */

const BUCKET = 'case-documents';
const GRACE_DAYS = 30;
/** Per-batch cap. Supabase Storage allows up to 1000 deletes per call; we
 *  use 200 to keep individual cron runs short and capped on slow-disk days. */
const BATCH_SIZE = 200;

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

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Pull a batch of soft-deleted docs with a storage path still attached.
  const { data: rows, error } = await admin
    .from('documents')
    .select('id, metadata')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)
    .limit(BATCH_SIZE);

  if (error) {
    console.error('[cron/cleanup-blobs] select failed', { message: error.message });
    return NextResponse.json({ ok: false, error: 'select_failed' }, { status: 500 });
  }

  type StorageCandidate = { docId: string; path: string; metadata: Record<string, unknown> };
  const candidates: StorageCandidate[] = [];
  for (const row of rows ?? []) {
    if (!row.metadata || typeof row.metadata !== 'object' || Array.isArray(row.metadata)) continue;
    const meta = row.metadata as Record<string, unknown>;
    const path = meta.storage_path;
    if (typeof path !== 'string' || path.length === 0) continue;
    candidates.push({ docId: row.id, path, metadata: meta });
  }

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, scanned: rows?.length ?? 0, deleted: 0 });
  }

  // Bulk-remove blobs. Storage returns an error for missing paths, but a
  // missing object is the success state for us — log and proceed.
  const paths = candidates.map((c) => c.path);
  const { data: removed, error: removeErr } = await admin.storage.from(BUCKET).remove(paths);
  if (removeErr) {
    // Soft-fail per file would be ideal; the Storage client returns all-or-
    // nothing per .remove() call. If the bulk fails, log + don't update rows
    // so the next cron run retries.
    console.error('[cron/cleanup-blobs] storage.remove failed', {
      message: removeErr.message,
      pathCount: paths.length,
    });
    return NextResponse.json({ ok: false, error: 'storage_failed' }, { status: 500 });
  }

  // Strip storage_path from metadata on the rows we successfully cleaned —
  // both real removals and "already gone" (404). Either way the bytes are
  // off Storage so the path is stale.
  const removedNames = new Set((removed ?? []).map((r) => r.name));
  const updates = candidates.filter((c) => removedNames.has(c.path) || true);
  let updatedRows = 0;
  for (const c of updates) {
    const cleared = { ...c.metadata };
    delete cleared.storage_path;
    const { error: updateErr } = await admin
      .from('documents')
      // Record<string, unknown> → Json widening at the boundary.
      .update({ metadata: cleared as unknown as Json })
      .eq('id', c.docId);
    if (updateErr) {
      console.error('[cron/cleanup-blobs] metadata strip failed', {
        docId: c.docId,
        message: updateErr.message,
      });
      continue;
    }
    updatedRows += 1;
  }

  return NextResponse.json({
    ok: true,
    scanned: rows?.length ?? 0,
    candidates: candidates.length,
    deleted: removed?.length ?? 0,
    metadataCleared: updatedRows,
  });
}
