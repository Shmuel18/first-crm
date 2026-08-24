'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Loader2 } from 'lucide-react';

import { fetchPdfBytes } from '../domain/pdf-bytes';

/**
 * Draws one page of a PDF into a canvas.
 *
 * Why not an <iframe>: only desktop browsers embed a PDF viewer. Chrome on
 * Android has none at all — the frame renders as a grey "unsupported document"
 * tile, which is what the office saw on their phones while the same screen
 * looked fine on the computer. iOS Safari is barely better. Rasterising the
 * page ourselves looks identical everywhere.
 *
 * Two things are deliberately kept off the network as file-shaped requests,
 * because the office content filter answers those with its own block page:
 *   - the document bytes come through fetchPdfBytes (binary, then the base64
 *     envelope), never from pdf.js itself;
 *   - the pdf.js worker is bundled, so it arrives as a hashed /_next/static
 *     chunk like every other script the office already loads megabytes of,
 *     instead of a lone 1.4 MB file under /public.
 *
 * One worker serves every tile and every page: pdf.js scopes documents inside
 * a worker, and one dedicated worker per tile exhausts the browser's pool on a
 * full folder.
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
  /** Shown when rendering fails (blocked bytes, corrupt file). Without it a
   *  failure looked exactly like loading — a spinner that never ends. */
  fallback?: ReactNode;
};

type RenderState = 'idle' | 'done' | 'failed';

/** Chrome refuses canvases beyond ~16k in either axis; stay well inside. */
const MAX_CANVAS_PX = 8192;

type PdfjsModule = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfjsModule> | null = null;

/**
 * Load pdf.js once and give it a worker built by our own bundler. The
 * `new URL(..., import.meta.url)` form is what Turbopack/webpack recognise as a
 * worker entry, so the worker ships hashed under /_next/static.
 */
function loadPdfjs(): Promise<PdfjsModule> {
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
      console.error('[pdfPageCanvas] bundled worker failed, using /public copy', err);
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';
    }
    return pdfjs;
  })();
  return pdfjsPromise;
}

export function PdfPageCanvas({
  src,
  pageNumber = 1,
  width,
  className,
  onPageCount,
  fallback,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<RenderState>('idle');

  useEffect(() => {
    let cancelled = false;
    let destroyTask: (() => void) | undefined;

    void (async () => {
      try {
        const fetched = await fetchPdfBytes(src);
        if (cancelled) return;
        if (!fetched.ok) {
          // The attempt log is the whole point: on the office desktop it is the
          // only way to tell a blocked response from a corrupt file.
          console.error('[pdfPageCanvas] could not fetch bytes', {
            src,
            reason: fetched.reason,
            attempts: fetched.attempts,
          });
          setState('failed');
          return;
        }

        const pdfjs = await loadPdfjs();
        if (cancelled) return;

        const task = pdfjs.getDocument({
          data: fetched.bytes,
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
        // A long scan can be extreme enough that device pixels overflow the
        // canvas limit; scale down rather than fail to draw.
        const scale = Math.min(
          (width / base.width) * ratio,
          MAX_CANVAS_PX / base.width,
          MAX_CANVAS_PX / base.height,
        );
        const viewport = page.getViewport({ scale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = '100%';
        canvas.style.height = 'auto';

        await page.render({ canvasContext: context, viewport }).promise;
        if (!cancelled) setState('done');
        // The pixels are on the canvas now; the parsed document is just memory.
        // The shared worker stays up for the next tile.
        void task.destroy();
        destroyTask = undefined;
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
