import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { DOCUMENTS_BUCKET } from '@/features/documents/services/documents.service';
import { eraseDriveTargets } from '@/features/integrations/services/drive-case-uploader';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import type { Json } from '@/types/database';

/**
 * Daily cleanup of orphaned Storage blobs AND Google Drive copies whose
 * document was soft-deleted ≥ 30 days ago (LEGAL-3 right-to-erasure).
 * `deleteDocumentAction` flips `deleted_at` but intentionally leaves the files
 * alone so an accidental delete can be restored within the grace window. After
 * 30 days they're dead weight — and the Drive copy used to leak forever
 * (deleteCaseDocumentFromDrive was dead code, never called).
 *
 * Flow:
 *   1. SELECT documents WHERE deleted_at < now() - 30d that still have a
 *      storage_path OR a drive_file_id. Service-role read so RLS doesn't hide
 *      soft-deleted rows.
 *   2. storage.remove([paths]) for the blobs; strip metadata.storage_path for
 *      the ones Storage confirmed (a partial failure re-processes next run).
 *   3. Delete each drive_file_id from Drive; clear drive_file_id only for
 *      confirmed deletions so a transient Drive failure retries.
 *
 * Why a Route Handler instead of an RPC: storage.remove() lives in the
 * Storage API, not the SQL engine. pg_cron can't reach it directly. The
 * Vercel cron pulls the rows + calls Storage in one place, with the same
 * CRON_SECRET gating as the backup route.
 */

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
    .select('id, metadata, drive_file_id')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)
    .limit(BATCH_SIZE);

  if (error) {
    console.error('[cron/cleanup-blobs] select failed', { message: error.message });
    return NextResponse.json({ ok: false, error: 'select_failed' }, { status: 500 });
  }

  type Candidate = {
    docId: string;
    path: string | null;
    driveId: string | null;
    metadata: Record<string, unknown>;
  };
  const candidates: Candidate[] = [];
  for (const row of rows ?? []) {
    // metadata is loose Json; narrow to a plain record after the object guard.
    const metaObj =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const rawPath = metaObj.storage_path;
    const path = typeof rawPath === 'string' && rawPath.length > 0 ? rawPath : null;
    const driveId =
      typeof row.drive_file_id === 'string' && row.drive_file_id.length > 0
        ? row.drive_file_id
        : null;
    if (!path && !driveId) continue;
    candidates.push({ docId: row.id, path, driveId, metadata: metaObj });
  }

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, scanned: rows?.length ?? 0, deleted: 0, driveDeleted: 0 });
  }

  // --- Storage blobs ---
  // Bulk-remove blobs. Storage errors on missing paths, but a missing object is
  // the success state for us. The client is all-or-nothing per .remove() call —
  // on a bulk failure, log + don't update rows so the next cron run retries.
  const blobCandidates = candidates.filter(
    (c): c is Candidate & { path: string } => c.path !== null,
  );
  let blobsRemoved = 0;
  let metadataCleared = 0;
  if (blobCandidates.length > 0) {
    const paths = blobCandidates.map((c) => c.path);
    const { data: removed, error: removeErr } = await admin.storage
      .from(DOCUMENTS_BUCKET)
      .remove(paths);
    if (removeErr) {
      console.error('[cron/cleanup-blobs] storage.remove failed', {
        message: removeErr.message,
        pathCount: paths.length,
      });
      return NextResponse.json({ ok: false, error: 'storage_failed' }, { status: 500 });
    }
    blobsRemoved = removed?.length ?? 0;
    // Strip storage_path ONLY for blobs Storage confirmed it removed. Clearing
    // the pointer for a path that still exists orphans the bytes permanently;
    // already-gone paths just get re-scanned next run (harmless, self-limiting).
    const removedNames = new Set((removed ?? []).map((r) => r.name));
    for (const c of blobCandidates) {
      if (!removedNames.has(c.path)) continue;
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
      metadataCleared += 1;
    }
  }

  // --- Drive copies (LEGAL-3) ---
  // Erase the Drive file for docs past grace; clear drive_file_id ONLY for
  // confirmed deletions so a transient Drive failure retries next run.
  const driveCandidates = candidates.filter(
    (c): c is Candidate & { driveId: string } => c.driveId !== null,
  );
  let driveDeleted = 0;
  if (driveCandidates.length > 0) {
    const res = await eraseDriveTargets({ fileIds: driveCandidates.map((c) => c.driveId) });
    if (!res.connected) {
      console.warn('[cron/cleanup-blobs] Drive not connected — Drive copies not erased', {
        count: driveCandidates.length,
      });
    } else {
      const deletedSet = new Set(res.deleted);
      for (const c of driveCandidates) {
        if (!deletedSet.has(c.driveId)) continue;
        const { error: clearErr } = await admin
          .from('documents')
          .update({ drive_file_id: null })
          .eq('id', c.docId);
        if (clearErr) {
          console.error('[cron/cleanup-blobs] drive_file_id clear failed', {
            docId: c.docId,
            message: clearErr.message,
          });
          continue;
        }
        driveDeleted += 1;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: rows?.length ?? 0,
    candidates: candidates.length,
    deleted: blobsRemoved,
    metadataCleared,
    driveDeleted,
  });
}
