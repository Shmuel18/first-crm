import { fileTypeFromBuffer } from 'file-type';
import type { useTranslations } from 'next-intl';
import { z } from 'zod';

import {
  ALLOWED_MIME_TYPES,
  DocumentMetadataSchema,
  MAX_FILE_SIZE_BYTES,
  type DocumentMetadataInput,
} from '../schemas/document.schema';

/**
 * All the synchronous + magic-byte validation that runs before we touch
 * auth, storage, or the DB. Lives in domain/ because it's pure (apart from
 * file-type reading the buffer) and now testable independently of the
 * action's auth + Supabase wiring.
 *
 * `t` is whatever next-intl getTranslations('documents.errors') returns —
 * typed loosely so the helper doesn't need to drag the full next-intl
 * type surface in. Pass `(await getTranslations('documents.errors'))`.
 */
type Translator = Awaited<ReturnType<typeof useTranslations>>;

type ParsedUploadInput =
  | { ok: true; caseId: string; file: File; meta: DocumentMetadataInput }
  | { ok: false; error: 'validation'; message?: string; fieldErrors?: Record<string, string> };

const CaseIdSchema = z.string().uuid();

export async function parseUploadInput(
  formData: FormData,
  t: Translator,
): Promise<ParsedUploadInput> {
  const caseId = formData.get('case_id');
  const file = formData.get('file');

  const caseIdResult = CaseIdSchema.safeParse(caseId);
  if (!caseIdResult.success) {
    return { ok: false, error: 'validation', message: t('caseIdMissing') };
  }
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

  return { ok: true, caseId: caseIdResult.data, file, meta: meta.data };
}
