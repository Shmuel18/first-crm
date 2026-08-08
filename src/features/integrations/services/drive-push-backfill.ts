import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

import { uploadCaseDocumentToDrive } from './drive-case-uploader';

const BUCKET = 'case-documents';

/**
 * Cap pushes per sync pass. Each push downloads the full blob out of Storage
 * and round-trips the bytes to Drive, and the sync often piggybacks on a
 * documents-page load (autoSyncIfStale) — a large backlog must not stall that
 * request. Leftovers drain on subsequent syncs (min 10s apart).
 */
const MAX_PUSHES_PER_SYNC = 5;

/**
 * Only push files older than this. A just-uploaded file usually has its
 * after() Drive mirror still in flight; pushing it here too would land the
 * same bytes in Drive twice (the loser of the stamp race becomes an orphan
 * Drive file that the next pull-sync imports as a duplicate row).
 */
const PUSH_GRACE_MS = 10 * 60 * 1000;

type PushTarget =
  | { kind: 'document'; id: string; storagePath: string; fileName: string; mimeType: string; driveFolder: string }
  | { kind: 'receipt'; id: string; storagePath: string; fileName: string; mimeType: string };

/**
 * Push direction of the Drive sync: app-uploaded files whose best-effort
 * after() Drive mirror failed or was skipped — drive_file_id (documents) or
 * receipt_drive_id (case_expenses) still NULL while the blob sits in Storage —
 * are re-uploaded to Drive here. This is the backfill the upload actions'
 * comments promise. Best-effort: never throws, logs failures, returns the
 * number of files pushed.
 *
 * Runs AFTER the pull/import pass on purpose: a file pushed before the folder
 * listings would show up in them without being in existingByDriveId, and the
 * importer would insert a duplicate row. Pushed after the listings, it is
 * first listed on the NEXT pass with its id already stamped → skipped.
 */
export async function pushLocalOnlyFilesToDrive(caseId: string): Promise<number> {
  try {
    const ctx = await getPushContext(caseId);
    if (!ctx) return 0;
    const targets = [
      ...(await collectDocumentTargets(caseId)),
      ...(await collectReceiptTargets(caseId)),
    ];
    let pushed = 0;
    for (const target of targets.slice(0, MAX_PUSHES_PER_SYNC)) {
      if (await pushOne(caseId, ctx, target)) pushed += 1;
    }
    return pushed;
  } catch (err) {
    console.error('[drivePushBackfill] failed', { caseId, err });
    return 0;
  }
}

type PushContext = { caseNumber: string; familyName: string };

/** Case number + family name feed the Drive folder naming (same as the mirrors). */
async function getPushContext(caseId: string): Promise<PushContext | null> {
  const supabase = await createClient();
  const { data: caseRow } = await supabase
    .from('cases')
    .select('case_number, primary_borrower_id')
    .eq('id', caseId)
    .maybeSingle();
  if (!caseRow) return null;

  let familyName = 'Case';
  if (caseRow.primary_borrower_id) {
    const { data: borrower } = await supabase
      .from('borrowers')
      .select('first_name, last_name')
      .eq('id', caseRow.primary_borrower_id)
      .maybeSingle();
    familyName =
      [borrower?.last_name, borrower?.first_name].filter(Boolean).join('_') || 'Case';
  }
  return { caseNumber: caseRow.case_number, familyName };
}

async function collectDocumentTargets(caseId: string): Promise<PushTarget[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - PUSH_GRACE_MS).toISOString();
  const { data } = await supabase
    .from('documents')
    .select('id, file_name, mime_type, metadata, category:category_id(drive_folder)')
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .is('drive_file_id', null)
    .not('metadata->>storage_path', 'is', null)
    .lt('created_at', cutoff)
    .limit(MAX_PUSHES_PER_SYNC);

  const targets: PushTarget[] = [];
  for (const doc of data ?? []) {
    const storagePath = readStoragePath(doc.metadata);
    // No category → no Drive subfolder to target; same skip as the upload mirror.
    if (!storagePath || !doc.category?.drive_folder) continue;
    targets.push({
      kind: 'document',
      id: doc.id,
      storagePath,
      fileName: doc.file_name,
      mimeType: doc.mime_type ?? 'application/octet-stream',
      driveFolder: doc.category.drive_folder,
    });
  }
  return targets;
}

async function collectReceiptTargets(caseId: string): Promise<PushTarget[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - PUSH_GRACE_MS).toISOString();
  const { data } = await supabase
    .from('case_expenses')
    .select('id, receipt_path, receipt_name, receipt_mime')
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .is('receipt_drive_id', null)
    .not('receipt_path', 'is', null)
    .lt('updated_at', cutoff)
    .limit(MAX_PUSHES_PER_SYNC);

  return (data ?? [])
    .filter((e): e is typeof e & { receipt_path: string } => !!e.receipt_path)
    .map((e) => ({
      kind: 'receipt',
      id: e.id,
      storagePath: e.receipt_path,
      fileName: e.receipt_name ?? e.receipt_path.split('/').pop() ?? 'receipt',
      mimeType: e.receipt_mime ?? 'application/octet-stream',
    }));
}

async function pushOne(
  caseId: string,
  ctx: PushContext,
  target: PushTarget,
): Promise<boolean> {
  // Service-role Storage read + stamp, same as the after() mirror. The stamp
  // especially must not be RLS-silenced: an update that "succeeds" with 0 rows
  // would leave the id NULL and re-push the same file to Drive every sync.
  const admin = createAdminClient();
  const { data: blob, error } = await admin.storage.from(BUCKET).download(target.storagePath);
  if (error || !blob) {
    console.error('[drivePushBackfill] blob download failed', {
      caseId,
      kind: target.kind,
      id: target.id,
    });
    return false;
  }

  const out = await uploadCaseDocumentToDrive({
    caseId,
    caseNumber: ctx.caseNumber,
    familyName: ctx.familyName,
    // Invoices share the misc catch-all folder, same as mirrorReceiptToDrive.
    driveFolder: target.kind === 'receipt' ? 'misc' : target.driveFolder,
    file: { content: await blob.arrayBuffer(), name: target.fileName, mimeType: target.mimeType },
  });
  if (!out.ok) {
    console.error('[drivePushBackfill] drive upload failed', {
      caseId,
      kind: target.kind,
      id: target.id,
      reason: out.reason,
    });
    return false;
  }

  if (target.kind === 'document') {
    await admin
      .from('documents')
      .update({ drive_file_id: out.driveFileId, drive_file_url: out.webViewLink })
      .eq('id', target.id)
      .is('drive_file_id', null); // don't clobber a concurrently-completed mirror
  } else {
    await admin
      .from('case_expenses')
      .update({ receipt_drive_id: out.driveFileId, receipt_drive_url: out.webViewLink })
      .eq('id', target.id)
      .eq('receipt_path', target.storagePath) // receipt replaced mid-push → don't stamp the old file
      .is('receipt_drive_id', null);
  }
  return true;
}

function readStoragePath(meta: Json | null): string | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const value = meta.storage_path;
  return typeof value === 'string' && value.length > 0 ? value : null;
}
