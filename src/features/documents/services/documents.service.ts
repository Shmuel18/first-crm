import {
  deleteCaseDocumentFromDrive,
  uploadCaseDocumentToDrive,
} from '@/features/integrations/services/drive-case-uploader';
import { createClient } from '@/lib/supabase/server';
import type { CaseId } from '@/lib/types/branded';

import {
  type DocumentCategoryRow,
  type DocumentWithRelations,
} from '../types';

// Explicit column list (audit-driven). Mirrors the documents Row type so
// schema additions are gated by an intentional update here rather than
// auto-propagating to clients via `*`.
const DOCUMENT_FULL_COLUMNS =
  'id, case_id, borrower_id, category_id, file_name, file_size, mime_type, status, notes, drive_file_id, drive_file_url, upload_date, expiry_date, uploaded_by, verified_at, verified_by, metadata, deleted_at, created_at, updated_at' as const;

const DOCUMENT_SELECT = `
  ${DOCUMENT_FULL_COLUMNS},
  category:document_categories(id, key, name_he, name_en, drive_folder),
  uploader:uploaded_by(id, first_name, last_name),
  borrower:borrower_id(id, first_name, last_name)
` as const;

export async function listDocumentsForCase(
  caseId: CaseId,
): Promise<DocumentWithRelations[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('documents')
    .select(DOCUMENT_SELECT)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .order('upload_date', { ascending: false });

  if (error) throw error;
  // PostgREST embedded-relation typing gap; shape per DOCUMENT_SELECT.
  return (data ?? []) as unknown as DocumentWithRelations[];
}

// Explicit column list (audit-driven) — gates schema-add propagation.
const DOCUMENT_CATEGORY_FULL_COLUMNS =
  'id, key, name_he, name_en, drive_folder, is_active, is_system, sort_order, created_at, updated_at' as const;

export async function listDocumentCategories(): Promise<DocumentCategoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('document_categories')
    .select(DOCUMENT_CATEGORY_FULL_COLUMNS)
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw error;
  return data ?? [];
}

export function storagePathFor(
  caseId: string,
  documentId: string,
  fileName: string,
): string {
  const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
  const safeExt = ext ? `.${ext.toLowerCase()}` : '';
  return `${caseId}/${documentId}${safeExt}`;
}

/**
 * Signed URL for a stored document. Default 60s — Supabase storage signed
 * URLs are unauthenticated bearer tokens for their entire lifetime, so a
 * URL captured from history / a corporate proxy / a screenshare gives the
 * holder access to PII (national IDs, bank statements) for that window.
 * The iframe preview loads instantly; 60s is plenty for the success path.
 * Callers that need a longer URL (e.g. async generation) pass it explicitly.
 */
export async function signedUrlFor(
  storagePath: string,
  expiresInSeconds = 60,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from('case-documents')
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data) return null;
  return data.signedUrl;
}

const BUCKET = 'case-documents';

export type UploadBlobsResult =
  | {
      ok: true;
      storagePath: string;
      driveFileId: string | null;
      driveFileUrl: string | null;
    }
  | { ok: false; error: 'storage'; message: string };

export type UploadBlobsContext = {
  caseNumber: string;
  familyName: string;
  driveFolder: string | null;
};

/**
 * Read the case + category + (optional) borrower in parallel and assemble
 * the UploadBlobsContext that drives Drive folder naming. Lives next to
 * uploadDocumentBlobs because the two are always called as a pair.
 *
 * Returns `null` when the case row can't be read — usually means the
 * caller doesn't have permission (RLS denied) or the id is wrong. The
 * action layer maps that to 'unauthorized'.
 */
export async function resolveUploadContext(
  caseId: string,
  categoryId: string,
  borrowerId: string | null,
): Promise<UploadBlobsContext | null> {
  const supabase = await createClient();
  const [caseRow, category, borrower] = await Promise.all([
    supabase.from('cases').select('id, case_number').eq('id', caseId).maybeSingle(),
    supabase
      .from('document_categories')
      .select('drive_folder')
      .eq('id', categoryId)
      .maybeSingle(),
    borrowerId
      ? supabase
          .from('borrowers')
          .select('first_name, last_name')
          .eq('id', borrowerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!caseRow.data) return null;

  const familyName =
    [borrower.data?.first_name, borrower.data?.last_name].filter(Boolean).join('_') || 'Case';
  return {
    caseNumber: caseRow.data.case_number,
    familyName,
    driveFolder: category.data?.drive_folder ?? null,
  };
}

/**
 * Blob-first upload: stage the file to Supabase Storage (primary) and Drive
 * (secondary, best-effort) using a pre-generated documentId. The caller
 * INSERTs the documents row AFTER this resolves, passing the returned
 * storage_path / drive_* refs. If that INSERT then fails, rollbackBlobs
 * cleans up - either way we never leave an empty document row.
 */
export async function uploadDocumentBlobs(
  documentId: string,
  caseId: string,
  file: File,
  ctx: UploadBlobsContext,
): Promise<UploadBlobsResult> {
  const supabase = await createClient();
  const path = storagePathFor(caseId, documentId, file.name);

  const { error: storageErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (storageErr) return { ok: false, error: 'storage', message: storageErr.message };

  // Post-upload size verification. Supabase storage is S3-backed and very
  // rarely commits a truncated object — but a mid-transfer truncation that
  // *does* commit would silently land a partial PDF that staff later opens.
  // .list() returns the stored object's metadata.size; mismatch → reject
  // and remove the orphan. Fail-open on list-errors: an unverifiable upload
  // is better than rejecting every legitimate one when the metadata API
  // hiccups.
  const folder = path.substring(0, path.lastIndexOf('/'));
  const fileName = path.substring(path.lastIndexOf('/') + 1);
  const { data: listed, error: listErr } = await supabase.storage
    .from(BUCKET)
    .list(folder, { search: fileName });
  if (listErr) {
    console.warn('[uploadDocumentBlobs] post-upload size check skipped', listErr);
  } else {
    const entry = listed?.find((e) => e.name === fileName);
    const storedSize =
      entry?.metadata && typeof entry.metadata === 'object' && 'size' in entry.metadata
        ? Number((entry.metadata as { size: unknown }).size)
        : null;
    if (storedSize !== null && Number.isFinite(storedSize) && storedSize !== file.size) {
      await supabase.storage
        .from(BUCKET)
        .remove([path])
        .catch(() => undefined);
      return {
        ok: false,
        error: 'storage',
        message: `size mismatch: stored=${storedSize} expected=${file.size}`,
      };
    }
  }

  let driveFileId: string | null = null;
  let driveFileUrl: string | null = null;
  if (ctx.driveFolder) {
    const buf = await file.arrayBuffer();
    const out = await uploadCaseDocumentToDrive({
      caseId,
      caseNumber: ctx.caseNumber,
      familyName: ctx.familyName,
      driveFolder: ctx.driveFolder,
      file: { content: buf, name: file.name, mimeType: file.type },
    });
    if (out.ok) {
      driveFileId = out.driveFileId;
      driveFileUrl = out.webViewLink;
    }
  }

  return { ok: true, storagePath: path, driveFileId, driveFileUrl };
}

/**
 * Compensating cleanup if the documents INSERT after uploadDocumentBlobs
 * fails. Both calls are best-effort - we already lost atomicity once the
 * blobs landed; this just minimizes orphan cost.
 */
export async function rollbackDocumentBlobs(
  storagePath: string,
  driveFileId: string | null,
): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => undefined);
  if (driveFileId) {
    await deleteCaseDocumentFromDrive(driveFileId);
  }
}
