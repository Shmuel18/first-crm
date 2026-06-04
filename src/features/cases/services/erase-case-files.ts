import { DOCUMENTS_BUCKET } from '@/features/documents/services/documents.service';
import { eraseDriveTargets } from '@/features/integrations/services/drive-case-uploader';
import { createAdminClient } from '@/lib/supabase/admin';

export type CaseFileRefs = {
  storagePaths: string[];
  driveFileIds: string[];
  caseFolderId: string | null;
};

/**
 * Gather every Storage object path + Drive file/folder id for a case BEFORE it
 * is permanently deleted. The hard-delete cascade removes the `documents` rows,
 * after which these references are unrecoverable. Uses the service-role client
 * so it sees ALL documents (including already-soft-deleted ones) regardless of
 * RLS — a permanent case delete erases everything for that case.
 */
export async function collectCaseFileRefs(caseId: string): Promise<CaseFileRefs> {
  const admin = createAdminClient();

  const { data: docs } = await admin
    .from('documents')
    .select('drive_file_id, metadata')
    .eq('case_id', caseId);

  const storagePaths: string[] = [];
  const driveFileIds: string[] = [];
  for (const doc of docs ?? []) {
    const meta = doc.metadata;
    // metadata is loose Json; after the object guard, narrow to read storage_path.
    const path =
      meta && typeof meta === 'object' && !Array.isArray(meta)
        ? (meta as Record<string, unknown>).storage_path
        : undefined;
    if (typeof path === 'string' && path.length > 0) storagePaths.push(path);
    if (doc.drive_file_id) driveFileIds.push(doc.drive_file_id);
  }

  // Expense receipts live in the same case-documents bucket + Drive case folder
  // (migrations 101 / 139). Erase them alongside documents on a permanent
  // delete — otherwise the cascade drops the rows and orphans the files.
  const { data: expenses } = await admin
    .from('case_expenses')
    .select('receipt_path, receipt_drive_id')
    .eq('case_id', caseId);
  for (const exp of expenses ?? []) {
    if (typeof exp.receipt_path === 'string' && exp.receipt_path.length > 0) {
      storagePaths.push(exp.receipt_path);
    }
    if (typeof exp.receipt_drive_id === 'string' && exp.receipt_drive_id.length > 0) {
      driveFileIds.push(exp.receipt_drive_id);
    }
  }

  const { data: caseRow } = await admin
    .from('cases')
    .select('metadata')
    .eq('id', caseId)
    .maybeSingle();
  // metadata.drive is an untyped JSON subtree; cast to read case_folder_id.
  const drive =
    caseRow?.metadata && typeof caseRow.metadata === 'object' && 'drive' in caseRow.metadata
      ? (caseRow.metadata as { drive?: { case_folder_id?: unknown } }).drive
      : undefined;
  const folderId = drive?.case_folder_id;
  const caseFolderId = typeof folderId === 'string' && folderId.length > 0 ? folderId : null;

  return { storagePaths, driveFileIds, caseFolderId };
}

/**
 * Best-effort erase of a case's Storage blobs + Drive copies AFTER the row has
 * been permanently deleted. The DB delete is authoritative; a cleanup failure
 * here is logged (with counts) for manual follow-up rather than thrown, so a
 * completed erasure never surfaces as an error to the admin. LEGAL-3.
 */
export async function eraseCaseFiles(caseId: string, refs: CaseFileRefs): Promise<void> {
  if (refs.storagePaths.length > 0) {
    const admin = createAdminClient();
    const { error } = await admin.storage.from(DOCUMENTS_BUCKET).remove(refs.storagePaths);
    if (error) {
      console.error('[eraseCaseFiles] storage remove failed', {
        caseId,
        count: refs.storagePaths.length,
        message: error.message,
      });
    }
  }

  if (refs.caseFolderId || refs.driveFileIds.length > 0) {
    const res = await eraseDriveTargets({
      folderId: refs.caseFolderId,
      fileIds: refs.driveFileIds,
    });
    if (!res.connected) {
      console.warn('[eraseCaseFiles] Drive not connected — Drive copies NOT erased', {
        caseId,
        caseFolderId: refs.caseFolderId,
        driveFileCount: refs.driveFileIds.length,
      });
    } else if (res.failed.length > 0) {
      console.error('[eraseCaseFiles] some Drive deletions failed', {
        caseId,
        deleted: res.deleted.length,
        failed: res.failed.length,
      });
    }
  }
}
