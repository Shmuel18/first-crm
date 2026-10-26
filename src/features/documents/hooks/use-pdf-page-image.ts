'use client';

import { useEffect, useState } from 'react';

import type { PDFDocumentProxy } from 'pdfjs-dist';

/** Chrome refuses canvases beyond ~16k in either axis; stay well inside. */
const MAX_CANVAS_PX = 8192;

export type PdfPageImage =
  | { status: 'idle' | 'failed' }
  | { status: 'done'; url: string; aspect: number };

/**
 * Rasterise one page of an already-open document to an image (object URL).
 *
 * An <img> rather than a live <canvas>: a 30-page statement drawn as canvases
 * at device resolution holds ~25 MB of pixels per page for as long as it is
 * mounted, which takes a phone down. A decoded image off-screen is memory the
 * browser is free to drop and re-decode.
 *
 * Does nothing until `enabled` (the page scrolled near the viewport).
 */
export function usePdfPageImage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  width: number,
  enabled: boolean,
): PdfPageImage {
  const [image, setImage] = useState<PdfPageImage>({ status: 'idle' });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let url: string | null = null;
    let cancelRender: (() => void) | undefined;

    void (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const scale = Math.min(
          (width / base.width) * ratio,
          MAX_CANVAS_PX / base.width,
          MAX_CANVAS_PX / base.height,
        );
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('no 2d context');

        const task = page.render({ canvasContext: context, viewport });
        cancelRender = () => task.cancel();
        await task.promise;
        cancelRender = undefined;
        if (cancelled) return;

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png'),
        );
        if (cancelled || !blob) {
          if (!cancelled) setImage({ status: 'failed' });
          return;
        }
        url = URL.createObjectURL(blob);
        setImage({ status: 'done', url, aspect: base.height / base.width });
      } catch (err) {
        if (cancelled) return;
        console.error('[usePdfPageImage] render failed', { pageNumber, err });
        setImage({ status: 'failed' });
      }
    })();

    return () => {
      cancelled = true;
      cancelRender?.();
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc, pageNumber, width, enabled]);

  return image;
}
