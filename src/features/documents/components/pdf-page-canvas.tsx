'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Loader2 } from 'lucide-react';

/**
 * Draws one page of a PDF into a canvas.
 *
 * Why not an <iframe>: only desktop browsers embed a PDF viewer. Chrome on
 * Android has none at all — the frame renders as a grey "unsupported document"
 * tile, which is exactly what the office saw on their phones while the same
 * screen looked fine on the computer. iOS Safari is barely better. Rasterising
 * the page ourselves looks identical everywhere.
 *
 * pdf.js is imported on demand so it stays out of the initial bundle, and its
 * worker and font data are served from our own /public — a blob: worker is
 * blocked by our CSP, and the fonts must not come from a CDN.
 *
 * Every mounted tile decodes its first page right away. A folder holds a
 * handful of documents and only page one is rasterised, so the work is small
 * and predictable; deferring on visibility was tried and traded a real,
 * observable render for a spinner that never resolves when the tab is not
 * compositing.
 */
type Props = {
  /** Same-origin URL of the PDF bytes. */
  src: string;
  pageNumber?: number;
  /** Rendered width in CSS pixels; the canvas is drawn at device resolution. */
  width: number;
  className?: string;
  /** Reports the document's page count once known. */
  onPageCount?: (pages: number) => void;
  /** Shown when rendering fails (worker blocked, corrupt file). Without it a
   *  failure looked exactly like loading — a spinner that never ends. */
  fallback?: ReactNode;
};

type RenderState = 'idle' | 'done' | 'failed';

export function PdfPageCanvas({ src, pageNumber = 1, width, className, onPageCount, fallback }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<RenderState>('idle');

  useEffect(() => {
    let cancelled = false;
    // Keep the handle so unmounting mid-decode (a fast scroll through a folder)
    // tears the work down instead of leaking a worker per tile.
    let destroyTask: (() => void) | undefined;

    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        // Same file as the .mjs pdfjs-dist ships, copied with a .js name: the
        // office network filter tolerates the .js the app already loads MBs of,
        // and an .mjs fetch is the kind of odd request such filters eat.
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';

        const task = pdfjs.getDocument({
          url: src,
          // Production CSP has no 'unsafe-eval', so pdf.js must not reach for
          // it, and the standard font data ships with us rather than a CDN.
          isEvalSupported: false,
          standardFontDataUrl: '/pdfjs/standard_fonts/',
        });
        destroyTask = () => void task.destroy();
        const doc = await task.promise;
        if (cancelled) return;
        onPageCount?.(doc.numPages);

        const page = await doc.getPage(Math.min(Math.max(pageNumber, 1), doc.numPages));
        if (cancelled) return;

        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) {
          setState('failed');
          return;
        }

        const base = page.getViewport({ scale: 1 });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: (width / base.width) * ratio });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = '100%';
        canvas.style.height = 'auto';

        await page.render({ canvasContext: context, viewport }).promise;
        if (!cancelled) setState('done');
      } catch (err) {
        if (cancelled) return;
        console.error('[pdfPageCanvas] render failed', err);
        setState('failed');
      }
    })();

    return () => {
      cancelled = true;
      destroyTask?.();
    };
    // onPageCount only reports upward; re-running on its identity would redraw
    // the page for nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, pageNumber, width]);

  return (
    <div className={className}>
      {state === 'idle' && (
        <div className="flex size-full items-center justify-center">
          <Loader2 className="size-5 animate-spin text-neutral-300" aria-hidden="true" />
        </div>
      )}
      {state === 'failed' && (
        <div className="flex size-full items-center justify-center">{fallback ?? null}</div>
      )}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        // Laid out (not display:none) while drawing — a canvas kept out of
        // layout can leave pdf.js's render task pending.
        className={state === 'done' ? 'block' : 'absolute size-0 opacity-0'}
      />
    </div>
  );
}
