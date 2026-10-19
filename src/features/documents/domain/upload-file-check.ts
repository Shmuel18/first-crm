import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../schemas/document.schema';

/** Files per upload batch — the office's agreed ceiling (Kaufman, 2026-08). */
export const MAX_FILES_PER_UPLOAD = 20;

export type UploadFileError = 'fileRequired' | 'fileTooLarge' | 'fileTypeNotAllowed';

/**
 * Client-side mirror of the server's upload guards, so a bad file is refused
 * before its bytes go up. The server re-checks everything (incl. magic bytes).
 */
export function getUploadFileError(file: { size: number; type: string }): UploadFileError | null {
  if (file.size === 0) return 'fileRequired';
  if (file.size > MAX_FILE_SIZE_BYTES) return 'fileTooLarge';
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) return 'fileTypeNotAllowed';
  return null;
}
