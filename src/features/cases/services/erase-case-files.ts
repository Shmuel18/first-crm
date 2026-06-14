import { DOCUMENTS_BUCKET } from '@/features/documents/services/documents.service';
import { eraseDriveTargets } from '@/features/integrations/services/drive-case-uploader';
import { createAdminClient } from '@/lib/supabase/admin';

type Admin = ReturnType<typeof createAdminClient>;
type OrphanEntity = 'document' | 'expense' | 'case';

/** One Storage/Drive pointer tied to its owning row, so a failed erasure can be
 *  recorded durably in erasure_orphan_log (mig 144/177) for manual cleanup. */
export type CaseFilePointer = {
  entity: 'document' | 'expense';
  rowId: string;
  storagePath: string | null;
  driveFileId: string | null;
};

export type CaseFileRefs = {
  pointers: CaseFilePointer[];
  /** The case's Drive folder (case-level, entity 'case' in the orphan log). */
  caseFolderId: string | null;
};

/**
 * Gather every Storage object path + Drive file/folder id for a case BEFORE it
 * is permanently deleted, KEEPING each pointer tied to its owning row + entity.
 * The hard-delete cascade removes the `documents` / `case_expenses` rows, after
 * which these references are unrecoverable. Uses the service-role client so it
 * sees ALL rows (incl. already-soft-deleted) regardless of RLS.
 */
export type CollectCaseFileRefsResult = { ok: true; refs: CaseFileRefs } | { ok: false };

export async function collectCaseFileRefs(caseId: string): Promise<CollectCaseFileRefsResult> {
  const admin = createAdminClient();
  const pointers: CaseFilePointer[] = [];

  const docsRes = await admin
    .from('documents')
    .select('id, drive_file_id, metadata')
    .eq('case_id', caseId);
  // FAIL-CLOSED: a read error must ABORT the permanent delete — proceeding with an
  // empty ref list would let the cascade drop the rows and orphan the files
  // forever (R5-lifecycle-2 follow-up). The caller must not delete on { ok:false }.
  if (docsRes.error) {
    console.error('[collectCaseFileRefs] documents read failed — aborting', {
      caseId,
      message: docsRes.error.message,
    });
    return { ok: false };
  }
  for (const doc of docsRes.data ?? []) {
    const meta = doc.metadata;
    const path =
      meta && typeof meta === 'object' && !Array.isArray(meta)
        ? (meta as Record<string, unknown>).storage_path
        : undefined;
    const storagePath = typeof path === 'string' && path.length > 0 ? path : null;
    const driveFileId =
      typeof doc.drive_file_id === 'string' && doc.drive_file_id.length > 0
        ? doc.drive_file_id
        : null;
    if (storagePath || driveFileId) {
      pointers.push({ entity: 'document', rowId: doc.id, storagePath, driveFileId });
    }
  }

  // Expense receipts live in the same case-documents bucket + Drive case folder.
  const expRes = await admin
    .from('case_expenses')
    .select('id, receipt_path, receipt_drive_id')
    .eq('case_id', caseId);
  if (expRes.error) {
    console.error('[collectCaseFileRefs] expenses read failed — aborting', {
      caseId,
      message: expRes.error.message,
    });
    return { ok: false };
  }
  for (const exp of expRes.data ?? []) {
    const storagePath =
      typeof exp.receipt_path === 'string' && exp.receipt_path.length > 0
        ? exp.receipt_path
        : null;
    const driveFileId =
      typeof exp.receipt_drive_id === 'string' && exp.receipt_drive_id.length > 0
        ? exp.receipt_drive_id
        : null;
    if (storagePath || driveFileId) {
      pointers.push({ entity: 'expense', rowId: exp.id, storagePath, driveFileId });
    }
  }

  const caseRes = await admin
    .from('cases')
    .select('metadata')
    .eq('id', caseId)
    .maybeSingle();
  if (caseRes.error) {
    console.error('[collectCaseFileRefs] case read failed — aborting', {
      caseId,
      message: caseRes.error.message,
    });
    return { ok: false };
  }
  const caseRow = caseRes.data;
  const drive =
    caseRow?.metadata && typeof caseRow.metadata === 'object' && 'drive' in caseRow.metadata
      ? (caseRow.metadata as { drive?: { case_folder_id?: unknown } }).drive
      : undefined;
  const folderId = drive?.case_folder_id;
  const caseFolderId = typeof folderId === 'string' && folderId.length > 0 ? folderId : null;

  return { ok: true, refs: { pointers, caseFolderId } };
}

type OrphanRow = {
  entity: OrphanEntity;
  row_id: string;
  storage_path: string | null;
  drive_file_id: string | null;
};

/**
 * Durable record of pointers that could NOT be erased (Storage error, Drive
 * disconnected, partial Drive failure). The owning DB rows are already gone, so
 * a console line is unrecoverable — erasure_orphan_log preserves the path/id for
 * manual cleanup, matching the cron purge path's contract (mig 144/177). The
 * orphan-log table predates the generated types; minimal cast on the insert.
 */
async function logOrphans(admin: Admin, rows: OrphanRow[], caseId: string): Promise<void> {
  if (rows.length === 0) return;
  const recordedAt = new Date().toISOString();
  const { error } = await (
    admin as unknown as {
      from: (t: 'erasure_orphan_log') => {
        insert: (r: Array<OrphanRow & { deleted_at: string }>) => PromiseLike<{
          error: { message: string } | null;
        }>;
      };
    }
  )
    .from('erasure_orphan_log')
    .insert(rows.map((r) => ({ ...r, deleted_at: recordedAt })));
  if (error) {
    console.error('[eraseCaseFiles] orphan-log insert failed', { caseId, message: error.message });
  }
}

/**
 * Best-effort erase of a case's Storage blobs + Drive copies AFTER the row has
 * been permanently deleted. The DB delete is authoritative; a cleanup failure is
 * logged AND recorded in erasure_orphan_log (so a leaked file is recoverable for
 * manual cleanup) rather than thrown. LEGAL-3 (R5-lifecycle-2).
 */
export async function eraseCaseFiles(caseId: string, refs: CaseFileRefs): Promise<void> {
  const admin = createAdminClient();
  const storagePointers = refs.pointers.filter((p) => p.storagePath);
  const drivePointers = refs.pointers.filter((p) => p.driveFileId);

  // --- Storage blobs ---
  if (storagePointers.length > 0) {
    const { error } = await admin.storage
      .from(DOCUMENTS_BUCKET)
      .remove(storagePointers.map((p) => p.storagePath as string));
    if (error) {
      console.error('[eraseCaseFiles] storage remove failed', {
        caseId,
        count: storagePointers.length,
        message: error.message,
      });
      await logOrphans(
        admin,
        storagePointers.map((p) => ({
          entity: p.entity,
          row_id: p.rowId,
          storage_path: p.storagePath,
          drive_file_id: null,
        })),
        caseId,
      );
    }
  }

  // --- Drive copies + the case folder ---
  if (refs.caseFolderId || drivePointers.length > 0) {
    const res = await eraseDriveTargets({
      folderId: refs.caseFolderId,
      fileIds: drivePointers.map((p) => p.driveFileId as string),
    });
    if (!res.connected) {
      console.warn('[eraseCaseFiles] Drive not connected — Drive copies NOT erased', {
        caseId,
        caseFolderId: refs.caseFolderId,
        driveFileCount: drivePointers.length,
      });
      const orphans: OrphanRow[] = drivePointers.map((p) => ({
        entity: p.entity,
        row_id: p.rowId,
        storage_path: null,
        drive_file_id: p.driveFileId,
      }));
      if (refs.caseFolderId) {
        orphans.push({
          entity: 'case',
          row_id: caseId,
          storage_path: null,
          drive_file_id: refs.caseFolderId,
        });
      }
      await logOrphans(admin, orphans, caseId);
    } else if (res.failed.length > 0) {
      console.error('[eraseCaseFiles] some Drive deletions failed', {
        caseId,
        deleted: res.deleted.length,
        failed: res.failed.length,
      });
      const failed = new Set(res.failed);
      const orphans: OrphanRow[] = drivePointers
        .filter((p) => failed.has(p.driveFileId as string))
        .map((p) => ({
          entity: p.entity,
          row_id: p.rowId,
          storage_path: null,
          drive_file_id: p.driveFileId,
        }));
      if (refs.caseFolderId && failed.has(refs.caseFolderId)) {
        orphans.push({
          entity: 'case',
          row_id: caseId,
          storage_path: null,
          drive_file_id: refs.caseFolderId,
        });
      }
      await logOrphans(admin, orphans, caseId);
    }
  }
}
