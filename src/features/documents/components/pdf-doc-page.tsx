'use client';

import { useEffect, useRef, useState } from 'react';

import { Loader2 } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import { usePdfPageImage } from '../hooks/use-pdf-page-image';

type Props = {
  doc: PDFDocumentProxy;
  pageNumber: number;
  /** Render width in CSS px (drawn at device resolution, shown at 100%). */
  width: number;
  /** Placeholder height / width until this page's own size is known. */
  aspect: number;
  alt: string;
  /** Start drawing this far before the page scrolls into view. */
  preloadMargin?: string;
  /** Pre-rendered image to show instead (Drive's render of page 1). Falls
   *  back to drawing the page if it fails to load. */
  overrideSrc?: string | null;
};

/**
 * One page in the scrolling viewer (or a thumbnail): a correctly-proportioned
 * placeholder that draws itself only when it nears the viewport, so opening a
 * 30-page statement does not rasterise all 30 pages up front.
 */
export function PdfDocPage({
  doc,
  pageNumber,
  width,
  aspect,
  alt,
  preloadMargin = '800px 0px',
  overrideSrc = null,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [overrideFailed, setOverrideFailed] = useState(false);
  const useOverride = Boolean(overrideSrc) && !overrideFailed;
  const image = usePdfPageImage(doc, pageNumber, width, near && !useOverride);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: preloadMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near, preloadMargin]);

  const shownAspect = image.status === 'done' ? image.aspect : aspect;

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden bg-white"
      style={{ aspectRatio: `1 / ${shownAspect}` }}
    >
      {near && useOverride && overrideSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={overrideSrc}
          alt={alt}
          onError={() => setOverrideFailed(true)}
          className="block size-full object-contain"
        />
      )}
      {!useOverride && image.status === 'done' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.url} alt={alt} className="block size-full" />
      )}
      {!useOverride && image.status === 'idle' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-5 animate-spin text-neutral-300" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
