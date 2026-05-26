'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { getTranslations } from 'next-intl/server';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { sanitizeFilename } from '../domain/sanitize-filename';
import { parseUploadInput } from '../domain/upload-input';
import {
  resolveUploadContext,
  rollbackDocumentBlobs,
  uploadDocumentBlobs,
} from '../services/documents.service';
import type { DocumentActionState } from '../types';

/**
 * Blob-first upload (#13, #12 partial). Order:
 *   1. Validate input (incl. magic-byte sniff) via parseUploadInput.
 *   2. Auth + permission gate.
 *   3. Resolve Drive folder context (case + category + borrower) in parallel.
 *   4. Pre-generate documentId so storage path and DB id stay in sync.
 *   5. Upload blob to Supabase Storage (primary) + Drive (best-effort).
 *   6. INSERT the documents row pointing to the staged blobs.
 *   7. On INSERT failure → rollback both blobs.
 *
 * Why blob-first: after the RLS hardening in migration 022/024 stripped
 * FOR DELETE policies, the old "insert row → upload blob → on failure
 * delete row" path falls back to setting status='rejected' (because
 * .delete() is blocked), leaving zombie rows behind. With blob-first, a
 * storage failure short-circuits before any DB write so no orphan exists.
 */
export async function uploadDocumentAction(
  _prev: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const t = await getTranslations('documents.errors');

  const input = await parseUploadInput(formData, t);
  if (!input.ok) {
    return input.fieldErrors
      ? { ok: false, error: 'validation', fieldErrors: input.fieldErrors }
      : { ok: false, error: 'validation', message: input.message };
  }
  const { caseId, file, meta } = input;

  // Sanitize the browser-supplied filename before we touch any DB row or
  // external service. file.name can contain control bytes, RTL-override
  // chars (used to disguise extensions), or FS-reserved chars that break
  // Drive object naming.
  const safeFileName = sanitizeFilename(file.name);
  if (!safeFileName) {
    return { ok: false, error: 'validation', message: t('fileRequired') };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  if (!(await userHasPermission('upload_document')) || !(await userCanEditCase(caseId))) {
    return { ok: false, error: 'unauthorized' };
  }

  // Resolve Drive folder context BEFORE staging blobs.
  const ctx = await resolveUploadContext(caseId, meta.category_id, meta.borrower_id ?? null);
  if (!ctx) return { ok: false, error: 'unauthorized' };

  const documentId = randomUUID();
  const blobs = await uploadDocumentBlobs(documentId, caseId, file, ctx);
  if (!blobs.ok) {
    console.error('[uploadDocument] blob staging failed', blobs.message);
    return { ok: false, error: 'storage' };
  }

  const { error: insertErr } = await supabase
    .from('documents')
    .insert({
      id: documentId,
      case_id: caseId,
      category_id: meta.category_id,
      borrower_id: meta.borrower_id ?? null,
      file_name: safeFileName,
      file_size: file.size,
      mime_type: file.type,
      notes: meta.notes ?? null,
      expiry_date: meta.expiry_date ?? null,
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

  revalidatePath(`/cases/${caseId}/documents`);
  revalidatePath(`/cases/${caseId}`);
  return { ok: true, documentId };
}
