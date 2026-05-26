'use server';

import { randomUUID } from 'node:crypto';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { sanitizeFilename } from '../domain/sanitize-filename';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../schemas/document.schema';
import { storagePathFor, resolveUploadContext } from '../services/documents.service';

const BUCKET = 'case-documents';

export type PrepareUploadInput = {
  caseId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  categoryId: string;
  borrowerId: string | null;
};

export type PrepareUploadResult =
  | {
      ok: true;
      /** Pre-generated document UUID — the client will POST it back at finalize. */
      documentId: string;
      /** Storage object path the client uploads to (also where finalize reads from). */
      path: string;
      /** Signed upload token + URL. Token-bearer can write to `path` for the URL's TTL. */
      token: string;
      signedUrl: string;
      /** Sanitized filename — the client should display this back to the user
       *  so they see exactly what landed on disk. */
      safeFileName: string;
    }
  | {
      ok: false;
      error: 'unauthorized' | 'validation' | 'storage' | 'unknown';
      message?: string;
    };

/**
 * Phase 1 of the direct-to-storage upload flow (batch 25).
 *
 *   Client → prepareUploadAction → returns signed URL + documentId
 *   Client → PUT bytes directly to that signed URL (no Server Action body)
 *   Client → finalizeUploadAction(documentId) → magic-byte check + Drive + DB row
 *
 * This shape lets a 20 MB file stream browser → Supabase storage without
 * passing through Vercel function memory or the 21 MB Server Action body
 * limit (see next.config.ts). The function-memory hit shrinks from the
 * full file to a 4 KB magic-byte sniff in finalize.
 *
 * Pre-upload validation here is metadata-only (size, declared mime, category
 * resolves). The bytes themselves get validated POST-upload in finalize —
 * the file-type library reads ~4 KB to detect the real format.
 */
export async function prepareUploadAction(
  input: PrepareUploadInput,
): Promise<PrepareUploadResult> {
  // Cheap metadata gates before we burn a signed-URL allocation.
  if (input.fileSize <= 0) return { ok: false, error: 'validation', message: 'fileRequired' };
  if (input.fileSize > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: 'validation', message: 'fileTooLarge' };
  }
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    return { ok: false, error: 'validation', message: 'fileTypeNotAllowed' };
  }

  const safeFileName = sanitizeFilename(input.fileName);
  if (!safeFileName) {
    return { ok: false, error: 'validation', message: 'fileRequired' };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  if (!(await userHasPermission('upload_document')) || !(await userCanEditCase(input.caseId))) {
    return { ok: false, error: 'unauthorized' };
  }

  // Validate the category + borrower link before issuing an upload token.
  // resolveUploadContext returns null when the case row is unreadable (RLS).
  const ctx = await resolveUploadContext(input.caseId, input.categoryId, input.borrowerId);
  if (!ctx) return { ok: false, error: 'unauthorized' };

  const documentId = randomUUID();
  const path = storagePathFor(input.caseId, documentId, safeFileName);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[prepareUpload] signed url failed', error);
    return { ok: false, error: 'storage' };
  }

  return {
    ok: true,
    documentId,
    path,
    token: data.token,
    signedUrl: data.signedUrl,
    safeFileName,
  };
}
