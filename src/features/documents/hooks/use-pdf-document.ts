'use client';

import { useEffect, useState } from 'react';

import type { PDFDocumentProxy } from 'pdfjs-dist';

import { fetchPdfBytes } from '../domain/pdf-bytes';

import { openPdf } from './pdfjs-loader';

export type PdfDocumentState =
  | { status: 'loading' }
  | { status: 'failed' }
  | {
      status: 'ready';
      doc: PDFDocumentProxy;
      /** height / width of page 1 — the placeholder shape for unrendered pages. */
      aspect: number;
    };

/**
 * Fetch + parse a PDF ONCE for a multi-page viewer, so every page and every
 * thumbnail draws from the same parsed document instead of each re-downloading
 * and re-parsing it. The bytes come through fetchPdfBytes (never pdf.js's own
 * fetch) because the office content filter blocks file-shaped responses.
 */
export function usePdfDocument(src: string): PdfDocumentState {
  // Keyed by src so a new document reads as loading without a synchronous
  // reset inside the effect.
  const [loaded, setLoaded] = useState<{ src: string; state: PdfDocumentState } | null>(null);
  const setState = (state: PdfDocumentState): void => setLoaded({ src, state });

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;

    void (async () => {
      try {
        const fetched = await fetchPdfBytes(src);
        if (cancelled) return;
        if (!fetched.ok) {
          // The attempt log is the only way to tell a blocked response from a
          // corrupt file on the office desktop.
          console.error('[usePdfDocument] could not fetch bytes', {
            src,
            reason: fetched.reason,
            attempts: fetched.attempts,
          });
          setState({ status: 'failed' });
          return;
        }
        const task = await openPdf(fetched.bytes);
        destroy = () => void task.destroy();
        if (cancelled) {
          destroy();
          return;
        }
        const doc = await task.promise;
        const first = (await doc.getPage(1)).getViewport({ scale: 1 });
        if (!cancelled) {
          setState({ status: 'ready', doc, aspect: first.height / first.width });
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[usePdfDocument] open failed', err);
        setState({ status: 'failed' });
      }
    })();

    return () => {
      cancelled = true;
      destroy?.();
    };
    // setState only closes over src, which is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return loaded?.src === src ? loaded.state : { status: 'loading' };
}
