'use client';

import type { PDFDocumentLoadingTask } from 'pdfjs-dist';

type PdfjsModule = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfjsModule> | null = null;

/**
 * Load pdf.js once and give it a worker built by our own bundler. The
 * `new URL(..., import.meta.url)` form is what Turbopack/webpack recognise as a
 * worker entry, so the worker ships hashed under /_next/static — the office
 * content filter blocks a lone 1.4 MB script under /public, and a blocked
 * worker kills every tile at once.
 *
 * One worker serves every tile and every page: pdf.js scopes documents inside
 * a worker, and one dedicated worker per tile exhausts the browser's pool on a
 * full folder.
 */
export function loadPdfjs(): Promise<PdfjsModule> {
  pdfjsPromise ??= (async () => {
    const pdfjs = await import('pdfjs-dist');
    try {
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(
        new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url),
        { type: 'module' },
      );
    } catch (err) {
      // Bundled worker unavailable (older browser, bundler surprise): fall back
      // to the copy under /public rather than losing rendering entirely.
      console.error('[pdfjs] bundled worker failed, using /public copy', err);
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';
    }
    return pdfjs;
  })();
  return pdfjsPromise;
}

/** Open a PDF from in-memory bytes with the options every viewer needs. */
export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentLoadingTask> {
  const pdfjs = await loadPdfjs();
  return pdfjs.getDocument({
    data: bytes,
    // Production CSP has no 'unsafe-eval', so pdf.js must not reach for it,
    // and the standard font data ships with us rather than a CDN.
    isEvalSupported: false,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
  });
}
