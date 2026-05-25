'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { fileTypeFromBuffer } from 'file-type';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import {
  ALLOWED_MIME_TYPES,
  DocumentMetadataSchema,
  MAX_FILE_SIZE_BYTES,
} from '../schemas/document.schema';
import {
  rollbackDocumentBlobs,
  uploadDocumentBlobs,
  type UploadBlobsContext,
} from '../services/documents.service';
import type { DocumentActionState } from '../types';

const CaseIdSchema = z.string().uuid();

/**
 * Blob-first upload (#13, #12 partial). Order:
 *   1. Validate input.
 *   2. Resolve Drive folder context (case + category + borrower).
 *   3. Pre-generate documentId so storage path and DB id stay in sync.
 *   4. Upload blob to Supabase Storage (primary) + Drive (best-effort).
 *   5. INSERT the documents row pointing to the staged blobs.
 *   6. On INSERT failure → rollback both blobs.
 *
 * Why blob-first matters: after the RLS hardening in migration 022/024
 * stripped FOR DELETE policies, the old "insert row → upload blob → on
 * failure delete row" path falls back to setting status='rejected' (because
 * .delete() is blocked) - leaving zombie rows behind. With blob-first, a
 * storage failure short-circuits before any DB write so no orphan exists.
 */
export async function uploadDocumentAction(
  _prev: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const t = await getTranslations('documents.errors');
  const caseId = formData.get('case_id');
  const file = formData.get('file');

  const caseIdResult = CaseIdSchema.safeParse(caseId);
  if (!caseIdResult.success) {
    return { ok: false, error: 'validation', message: t('caseIdMissing') };
  }
  const parsedCaseId = caseIdResult.data;
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'validation', message: t('fileRequired') };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: 'validation', message: t('fileTooLarge') };
  }
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'validation', message: t('fileTypeNotAllowed') };
  }
  // Magic-byte sniff: the browser-supplied file.type is attacker-controlled
  // (any multipart writer can lie). Inspect the actual bytes so an .exe or
  // an HTML page with <script> can't masquerade as application/pdf and land
  // in Drive/Storage for staff to download. file-type reads the first ~4100
  // bytes, which is enough for every format on ALLOWED_MIME_TYPES.
  const sniffBuf = Buffer.from(await file.slice(0, 4100).arrayBuffer());
  const sniffed = await fileTypeFromBuffer(sniffBuf);
  if (!sniffed || !(ALLOWED_MIME_TYPES as readonly string[]).includes(sniffed.mime)) {
    return { ok: false, error: 'validation', message: t('fileTypeNotAllowed') };
  }

  const meta = DocumentMetadataSchema.safeParse({
    category_id: formData.get('category_id'),
    borrower_id: formData.get('borrower_id'),
    notes: formData.get('notes'),
    expiry_date: formData.get('expiry_date'),
  });
  if (!meta.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of meta.error.issues) {
      const path = issue.path.join('.');
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: 'validation', fieldErrors };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  if (!(await userHasPermission('upload_document')) || !(await userCanEditCase(parsedCaseId))) {
    return { ok: false, error: 'unauthorized' };
  }

  // Resolve Drive folder context BEFORE staging blobs - small parallel reads.
  const [caseRow, category, borrower] = await Promise.all([
    supabase.from('cases').select('id, case_number').eq('id', parsedCaseId).maybeSingle(),
    supabase
      .from('document_categories')
      .select('drive_folder')
      .eq('id', meta.data.category_id)
      .maybeSingle(),
    meta.data.borrower_id
      ? supabase
          .from('borrowers')
          .select('first_name, last_name')
          .eq('id', meta.data.borrower_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!caseRow.data) return { ok: false, error: 'unauthorized' };

  const familyName =
    [borrower.data?.first_name, borrower.data?.last_name].filter(Boolean).join('_') || 'Case';
  const ctx: UploadBlobsContext = {
    caseNumber: caseRow.data.case_number,
    familyName,
    driveFolder: category.data?.drive_folder ?? null,
  };

  const documentId = randomUUID();
  const blobs = await uploadDocumentBlobs(documentId, parsedCaseId, file, ctx);
  if (!blobs.ok) {
    console.error('[uploadDocument] blob staging failed', blobs.message);
    return { ok: false, error: 'storage' };
  }

  const { error: insertErr } = await supabase
    .from('documents')
    .insert({
      id: documentId,
      case_id: parsedCaseId,
      category_id: meta.data.category_id,
      borrower_id: meta.data.borrower_id ?? null,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      notes: meta.data.notes ?? null,
      expiry_date: meta.data.expiry_date ?? null,
      uploaded_by: userRes.user.id,
      status: 'new',
      metadata: { storage_path: blobs.storagePath },
      drive_file_id: blobs.driveFileId,
      drive_file_url: blobs.driveFileUrl,
    });

  if (insertErr) {
    // INSERT failed (RLS, constraint, etc.) - blobs are orphaned. Clean up
    // best-effort. No row is created, so the user sees an error and can
    // retry without a stale "rejected" placeholder lingering.
    console.error('[uploadDocument] insert failed', insertErr);
    await rollbackDocumentBlobs(blobs.storagePath, blobs.driveFileId);
    return { ok: false, error: 'storage' };
  }

  revalidatePath(`/cases/${parsedCaseId}/documents`);
  revalidatePath(`/cases/${parsedCaseId}`);
  return { ok: true, documentId };
}
