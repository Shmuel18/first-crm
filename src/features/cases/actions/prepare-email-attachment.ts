'use server';

import { sanitizeFilename } from '@/features/documents/domain/sanitize-filename';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/features/documents/schemas/document.schema';
import { DOCUMENTS_BUCKET } from '@/features/documents/services/documents.service';
import { userCanEditCase } from '@/lib/auth/permissions';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

import { emailTmpPathFor } from '../services/email-attachments.service';

type PrepareEmailAttachmentInput = {
  caseId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

export type PrepareEmailAttachmentResult =
  | { ok: true; path: string; token: string; signedUrl: string; safeFileName: string }
  | { ok: false; error: 'unauthorized' | 'validation' | 'storage'; message?: string };

/**
 * Issues a signed upload URL for a NEW email attachment. The blob lands in a
 * transient `<caseId>/email-tmp/` path (same direct-to-storage pattern as
 * document uploads — keeps bytes off the 2 MB Server Action body budget). The
 * send action downloads it, attaches it, then deletes it. Metadata-only checks
 * here; the real magic-byte validation happens when the send action reads it.
 */
export async function prepareEmailAttachmentAction(
  input: PrepareEmailAttachmentInput,
): Promise<PrepareEmailAttachmentResult> {
  if (input.fileSize <= 0) return { ok: false, error: 'validation', message: 'fileRequired' };
  if (input.fileSize > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: 'validation', message: 'fileTooLarge' };
  }
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    return { ok: false, error: 'validation', message: 'fileTypeNotAllowed' };
  }
  const safeFileName = sanitizeFilename(input.fileName);
  if (!safeFileName) return { ok: false, error: 'validation', message: 'fileRequired' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userCanEditCase(input.caseId))) return { ok: false, error: 'unauthorized' };

  const path = emailTmpPathFor(input.caseId, safeFileName);
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[prepareEmailAttachment] signed url failed', safeDbError(error));
    return { ok: false, error: 'storage' };
  }

  return { ok: true, path, token: data.token, signedUrl: data.signedUrl, safeFileName };
}
