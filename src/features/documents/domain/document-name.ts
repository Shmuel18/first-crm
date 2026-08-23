import { sanitizeFilename } from './sanitize-filename';

/**
 * Trailing ".pdf" / ".docx" / ".7z" — the extension, not a dot inside the
 * name. Requires a letter in it, so a name ending in a date ("תלוש 01.2026")
 * doesn't lose its last segment to a fake extension.
 */
const EXTENSION_CANDIDATE = /\.[A-Za-z0-9]{1,12}$/;
const HAS_LETTER = /[A-Za-z]/;

function extensionOf(fileName: string): string {
  const candidate = fileName.match(EXTENSION_CANDIDATE)?.[0] ?? '';
  return HAS_LETTER.test(candidate) ? candidate : '';
}

/**
 * Apply an advisor-typed name to a file while keeping its extension.
 *
 * The office types meaningful names ("חוזה רכישה") and shouldn't have to think
 * about ".pdf" — but dropping the extension breaks how the file opens once it
 * leaves us (Drive, an email attachment, the recipient's disk). So the typed
 * name replaces only the base, and the original extension is re-appended
 * unless the advisor typed one.
 *
 * Returns null when the typed name sanitizes to nothing — the caller rejects.
 */
export function applyDocumentName(typed: string, currentFileName: string): string | null {
  const base = sanitizeFilename(typed);
  if (!base) return null;

  const currentExt = extensionOf(currentFileName);
  if (!currentExt) return base;
  return base.toLowerCase().endsWith(currentExt.toLowerCase()) ? base : `${base}${currentExt}`;
}

/** Display form: the name without its extension, which is noise on screen. */
export function documentDisplayName(fileName: string): string {
  const ext = extensionOf(fileName);
  return ext ? fileName.slice(0, -ext.length) || fileName : fileName;
}
