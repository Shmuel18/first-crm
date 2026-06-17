'use server';

import { revalidatePath } from 'next/cache';

import { fileTypeFromBuffer } from 'file-type';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { uploadCaseDocumentToDrive } from '@/features/integrations/services/drive-case-uploader';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

import { sanitizeFilename } from '../domain/sanitize-filename';
import { ALLOWED_MIME_TYPES } from '../schemas/document.schema';
import { DocumentMetadataSchema } from '../schemas/document.schema';
import { resolveUploadContext, storagePathFor } from '../services/documents.service';

const BUCKET = 'case-documents';
/** file-type reads ~4100 bytes for every supported format we accept. Pulling
 *  more is wasted bandwidth; pulling less misses MS Office sigs that live
 *  past the first 512 bytes. 4 KB hits the sweet spot. */
const MAGIC_SNIFF_BYTES = 4096;

export type FinalizeUploadInput = {
  documentId: string;
  caseId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  categoryId: string;
  borrowerId: string | null;
  expiryDate: string | null;
  notes: string | null;
};

export type FinalizeUploadResult =
  | { ok: true; documentId: string }
  | {
      ok: false;
      error: 'unauthorized' | 'validation' | 'storage' | 'unknown';
      message?: string;
    };

/**
 * Phase 2 of the direct-to-storage flow. The blob already landed in storage
 * via a signed upload URL (prepareUploadAction). This action:
 *   - Re-auths the caller (defense-in-depth — the signed upload URL was
 *     time-bound and tied to one path, but we don't want a stale prepare
 *     token to be replayed if auth changed since it was issued).
 *   - Downloads the first 4 KB of the just-uploaded object and runs the
 *     magic-byte sniff that used to live in parseUploadInput.
 *   - Cross-checks the stored object size against what the client claimed.
 *   - On any failure → removes the orphan blob and surfaces an error.
 *   - On success → upload to Drive (best-effort) + INSERT the documents row.
 */
export async function finalizeUploadAction(
  input: FinalizeUploadInput,
): Promise<FinalizeUploadResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // Recompute the storage path SERVER-SIDE from the (authz-gated) caseId +
  // documentId + sanitized filename — exactly what prepareUploadAction wrote.
  // NEVER trust a client-supplied path: an unbound path let a view_all user
  // point finalize at another case's blob → cross-case PII (R10 DOC-UP-1).
  const safeFileName = sanitizeFilename(input.fileName);
  if (!safeFileName) {
    return { ok: false, error: 'validation', message: 'fileRequired' };
  }
  const storagePath = storagePathFor(input.caseId, input.documentId, safeFileName);

  if (!(await userHasPermission('upload_document')) || !(await userCanEditCase(input.caseId))) {
    await cleanupBlob(supabase, storagePath);
    return { ok: false, error: 'unauthorized' };
  }

  // Validate metadata against the same Zod schema the action used to enforce.
  const metaParsed = DocumentMetadataSchema.safeParse({
    category_id: input.categoryId,
    borrower_id: input.borrowerId,
    notes: input.notes,
    expiry_date: input.expiryDate,
  });
  if (!metaParsed.success) {
    await cleanupBlob(supabase, storagePath);
    return { ok: false, error: 'validation' };
  }

  // Resolve the case + category + borrower context. resolveUploadContext was
  // called at prepare-time too, but case ownership / category may have
  // changed in the meantime (rare but possible — admin reassignments).
  const ctx = await resolveUploadContext(input.caseId, input.categoryId, input.borrowerId);
  if (!ctx) {
    await cleanupBlob(supabase, storagePath);
    return { ok: false, error: 'unauthorized' };
  }

  // ── Post-upload validation: size + magic bytes ─────────────────────────
  // Read first 4 KB via a Range request on a short-lived signed URL.
  // Cheaper than downloading the full file just to read 4 KB of header.
  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60);
  if (signErr || !signed?.signedUrl) {
    console.error('[finalizeUpload] failed to sign read URL', signErr);
    await cleanupBlob(supabase, storagePath);
    return { ok: false, error: 'storage' };
  }

  const sniffRes = await fetch(signed.signedUrl, {
    headers: { Range: `bytes=0-${MAGIC_SNIFF_BYTES - 1}` },
  });
  if (!sniffRes.ok) {
    console.error('[finalizeUpload] sniff fetch failed', sniffRes.status);
    await cleanupBlob(supabase, storagePath);
    return { ok: false, error: 'storage' };
  }
  const sniffBuf = Buffer.from(await sniffRes.arrayBuffer());
  const sniffed = await fileTypeFromBuffer(sniffBuf);
  if (!sniffed || !(ALLOWED_MIME_TYPES as readonly string[]).includes(sniffed.mime)) {
    await cleanupBlob(supabase, storagePath);
    return { ok: false, error: 'validation', message: 'fileTypeNotAllowed' };
  }

  // Cross-check stored size matches what the client claimed.
  const folder = storagePath.substring(0, storagePath.lastIndexOf('/'));
  const fileName = storagePath.substring(storagePath.lastIndexOf('/') + 1);
  const { data: listed } = await supabase.storage
    .from(BUCKET)
    .list(folder, { search: fileName });
  const entry = listed?.find((e) => e.name === fileName);
  const storedSize =
    entry?.metadata && typeof entry.metadata === 'object' && 'size' in entry.metadata
      ? Number((entry.metadata as { size: unknown }).size)
      : null;
  if (
    storedSize !== null &&
    Number.isFinite(storedSize) &&
    storedSize !== input.fileSize
  ) {
    console.warn('[finalizeUpload] size mismatch', { storedSize, claimed: input.fileSize });
    await cleanupBlob(supabase, storagePath);
    return { ok: false, error: 'validation', message: 'fileTooLarge' };
  }

  // ── Drive upload (best-effort) ────────────────────────────────────────
  let driveFileId: string | null = null;
  let driveFileUrl: string | null = null;
  if (ctx.driveFolder) {
    // Download the full file from Storage for Drive upload.
    // TODO future: have Drive pull from a signed URL directly so we don't
    // round-trip the bytes through this function.
    const { data: blob, error: dlErr } = await supabase.storage
      .from(BUCKET)
      .download(storagePath);
    if (!dlErr && blob) {
      const buf = await blob.arrayBuffer();
      const out = await uploadCaseDocumentToDrive({
        caseId: input.caseId,
        caseNumber: ctx.caseNumber,
        familyName: ctx.familyName,
        driveFolder: ctx.driveFolder,
        file: { content: buf, name: safeFileName, mimeType: sniffed.mime },
      });
      if (out.ok) {
        driveFileId = out.driveFileId;
        driveFileUrl = out.webViewLink;
      }
    }
  }

  // ── INSERT the documents row ──────────────────────────────────────────
  const { error: insertErr } = await supabase.from('documents').insert({
    id: input.documentId,
    case_id: input.caseId,
    category_id: input.categoryId,
    borrower_id: input.borrowerId,
    file_name: safeFileName,
    file_size: input.fileSize,
    mime_type: sniffed.mime, // server-validated mime, not what the client claimed
    notes: metaParsed.data.notes ?? null,
    expiry_date: metaParsed.data.expiry_date ?? null,
    uploaded_by: userRes.user.id,
    status: 'new',
    metadata: { storage_path: storagePath },
    drive_file_id: driveFileId,
    drive_file_url: driveFileUrl,
  });

  if (insertErr) {
    console.error('[finalizeUpload] insert failed', safeDbError(insertErr));
    await cleanupBlob(supabase, storagePath);
    // Drive blob is intentionally NOT cleaned up here — the existing
    // uploadDocumentBlobs path doesn't either, and an orphan Drive file
    // shows up in the next sync sweep.
    return { ok: false, error: 'storage' };
  }

  revalidatePath(`/cases/${input.caseId}/documents`);
  revalidatePath(`/cases/${input.caseId}`);
  return { ok: true, documentId: input.documentId };
}

async function cleanupBlob(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
}
