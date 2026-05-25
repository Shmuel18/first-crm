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

const DOCUMENT_SELECT = `
  *,
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

export async function listDocumentCategories(): Promise<DocumentCategoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('document_categories')
    .select('*')
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

export async function signedUrlFor(
  storagePath: string,
  expiresInSeconds = 300,
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
