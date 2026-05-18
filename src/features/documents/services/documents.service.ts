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
