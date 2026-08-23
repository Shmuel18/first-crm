/** Mime types the in-app print path can render into a print dialog: PDFs
 *  (Chrome's built-in viewer prints them) and images (wrapped in a one-page
 *  HTML shell). Office files have no browser renderer — they fall back to
 *  Drive's own viewer, which has a print of its own. */
export function isDirectlyPrintable(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType === 'application/pdf' || mimeType.startsWith('image/');
}
