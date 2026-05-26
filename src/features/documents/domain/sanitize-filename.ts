/**
 * Sanitize a user-supplied filename before it lands in the documents.file_name
 * column, audit log, email subjects, download Content-Disposition headers,
 * etc. The browser-supplied `file.name` is attacker-controlled; this strips
 * the surfaces that have caused real bugs in the past:
 *
 * - Control bytes (\x00-\x1F, \x7F) can mess with HTTP headers and log
 *   parsers ("file\r\nContent-Disposition: …evil").
 * - Bidi-control + RTL-override characters (‎‏‪-‮⁦-
 *   ⁩) let an attacker hide the real extension visually
 *   ("Statement.pdf‮fdp.exe" renders as Statement.pdfexe.pdf).
 * - Filesystem-reserved chars (\\ / : * ? " < > |) are stripped to keep the
 *   string usable as a Drive object name without surprise rewrites.
 * - Cap to 200 chars so a 64 KB malicious name can't bloat audit rows /
 *   email subjects.
 *
 * Returns null when the sanitized result is empty — the caller should reject
 * the upload rather than silently saving an unnamed file.
 */
const CONTROL_BYTES = /[\x00-\x1F\x7F]/g;
const BIDI_CONTROLS = /[‎‏‪-‮⁦-⁩]/g;
const FS_RESERVED = /[\\/:*?"<>|]/g;
const MAX_LEN = 200;

export function sanitizeFilename(raw: string): string | null {
  const stripped = raw
    .normalize('NFC')
    .replace(CONTROL_BYTES, '')
    .replace(BIDI_CONTROLS, '')
    .replace(FS_RESERVED, '_')
    .trim();
  if (stripped.length === 0) return null;
  return stripped.length > MAX_LEN ? stripped.slice(0, MAX_LEN) : stripped;
}
