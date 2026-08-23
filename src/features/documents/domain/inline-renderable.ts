/**
 * Mime types the app serves inline from its own origin AND the browser can
 * actually display. The download route only re-serves an allowlisted set of
 * Content-Types (anything else becomes application/octet-stream, which renders
 * as a broken image), so the UI's "can I preview this?" test has to be the same
 * list — otherwise a card points an <img> at bytes the browser will refuse.
 *
 * HEIC/HEIF are included deliberately: Safari displays them, and iPhone uploads
 * are a large share of this office's documents. Chrome shows its broken-image
 * glyph for those, exactly as it did before — no regression, and the file still
 * opens, prints and downloads.
 */
export const INLINE_RENDERABLE_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export function isInlineRenderable(mimeType: string | null): boolean {
  return mimeType !== null && INLINE_RENDERABLE_MIME_TYPES.has(mimeType);
}

/**
 * Above this, a grid tile does NOT stream the file just to draw a thumbnail —
 * one folder view would pull tens of megabytes through the server for pictures
 * a few hundred pixels wide. Large files fall back to the file-type icon and
 * are still previewed in full when opened.
 */
export const MAX_THUMBNAIL_BYTES = 3 * 1024 * 1024;
