import {
  deleteCaseDocumentFromDrive,
  uploadCaseDocumentToDrive,
} from '@/features/integrations/services/drive-case-uploader';
import { createClient } from '@/lib/supabase/server';
import type { CaseId, DocumentId } from '@/lib/types/branded';

import {
  DRIVE_FOLDERS,
  type DocumentCategoryRow,
  type DocumentRow,
  type DocumentWithRelations,
  type DocumentsByFolder,
  type DriveFolder,
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
  return (data ?? []) as unknown as DocumentWithRelations[];
}

export async function getDocumentById(
  id: DocumentId,
): Promise<DocumentWithRelations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('documents')
    .select(DOCUMENT_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as unknown as DocumentWithRelations | null;
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

export function groupDocumentsByFolder(
  documents: ReadonlyArray<DocumentWithRelations>,
): DocumentsByFolder {
  const buckets: DocumentsByFolder = {
    identity: [],
    income_il: [],
    income_abroad: [],
    insurance_collateral: [],
  };

  for (const doc of documents) {
    const folder = doc.category?.drive_folder as DriveFolder | undefined;
    if (folder && DRIVE_FOLDERS.includes(folder)) {
      buckets[folder].push(doc);
    }
  }

  return buckets;
}

export function summarizeDocuments(
  documents: ReadonlyArray<DocumentRow>,
): { total: number; verified: number; pending: number; missing: boolean } {
  const total = documents.length;
  const verified = documents.filter((d) => d.status === 'verified').length;
  const pending = documents.filter((d) => d.status === 'new').length;
  return {
    total,
    verified,
    pending,
    missing: total === 0,
  };
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
