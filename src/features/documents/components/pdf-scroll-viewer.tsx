'use client';

import { useEffect, useRef, useState } from 'react';

import { FileQuestion, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { usePdfDocument } from '../hooks/use-pdf-document';

import { PdfDocPage } from './pdf-doc-page';

type Props = {
  src: string;
  fileName: string;
  /** Google-rasterized image of page 1 (Drive-synced docs only); covers the
   *  drawn page 1 when it loads. */
  driveImageSrc?: string | null;
  /** Full-screen modal: fill the height and show the thumbnail rail (desktop). */
  fill?: boolean;
};

/**
 * Continuous-scroll PDF view, like Drive: every page stacked, drawn lazily as
 * it nears the viewport, with a thumbnail rail on wide screens that jumps to a
 * page and follows the current one. We rasterise pages ourselves (pdf.js)
 * because Android has no embedded PDF viewer and iOS barely has one.
 */
export function PdfScrollViewer({ src, fileName, driveImageSrc = null, fill = false }: Props) {
  const t = useTranslations('documents.previewModal');
  const pdf = usePdfDocument(src);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [current, setCurrent] = useState(1);

  const pageCount = pdf.status === 'ready' ? pdf.doc.numPages : 0;

  // Current page = the last page whose top has passed the upper third of the
  // scroll area. Cheap enough per scroll event for any real document.
  const onScroll = (): void => {
    const container = scrollRef.current;
    if (!container) return;
    const line = container.getBoundingClientRect().top + container.clientHeight / 3;
    let page = 1;
    pageRefs.current.forEach((el, i) => {
      if (el && el.getBoundingClientRect().top <= line) page = i + 1;
    });
    setCurrent(page);
  };

  // Keep the active thumbnail visible as the reader scrolls past it.
  useEffect(() => {
    thumbRefs.current[current - 1]?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const goTo = (page: number): void => {
    pageRefs.current[page - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (pdf.status === 'loading') {
    return <Loader2 className="size-5 animate-spin text-neutral-400" aria-hidden="true" />;
  }
  if (pdf.status === 'failed') {
    return (
      <div className="px-4 py-12 text-center text-neutral-500">
        <FileQuestion className="mx-auto mb-3 size-10 text-neutral-300" aria-hidden="true" />
        <p className="text-sm">{t('noPreview')}</p>
      </div>
    );
  }

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <div className={`flex w-full gap-3 self-stretch ${fill ? 'h-full' : 'h-[58vh]'}`}>
      {fill && pageCount > 1 && (
        <nav
          aria-label={t('thumbnails')}
          className="hidden w-28 shrink-0 flex-col gap-3 overflow-y-auto py-3 ps-3 md:flex"
        >
          {pages.map((n) => (
            <button
              key={n}
              ref={(el) => {
                thumbRefs.current[n - 1] = el;
              }}
              type="button"
              onClick={() => goTo(n)}
              aria-label={t('goToPage', { page: n })}
              aria-current={n === current ? 'page' : undefined}
              className={`shrink-0 rounded-sm border bg-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 ${
                n === current
                  ? 'border-brand-gold ring-2 ring-brand-gold'
                  : 'border-neutral-200 hover:border-neutral-400'
              }`}
            >
              <PdfDocPage
                doc={pdf.doc}
                pageNumber={n}
                width={160}
                aspect={pdf.aspect}
                alt=""
                preloadMargin="300px 0px"
              />
              <span className="block py-0.5 text-center text-[10px] text-neutral-500">{n}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="relative min-w-0 flex-1">
        <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto p-3">
          <div className="mx-auto flex max-w-5xl flex-col gap-3">
            {pages.map((n) => (
              <div
                key={n}
                ref={(el) => {
                  pageRefs.current[n - 1] = el;
                }}
                className="shadow-sm ring-1 ring-neutral-200"
              >
                <PdfDocPage
                  doc={pdf.doc}
                  pageNumber={n}
                  width={fill ? 1024 : 900}
                  aspect={pdf.aspect}
                  alt={`${fileName} — ${t('pageOf', { page: n, total: pageCount })}`}
                  overrideSrc={n === 1 ? driveImageSrc : null}
                />
              </div>
            ))}
          </div>
        </div>
        {pageCount > 1 && (
          <span
            aria-live="polite"
            className="pointer-events-none absolute bottom-3 start-1/2 -translate-x-1/2 rounded-full bg-brand-black/75 px-3 py-1 text-xs text-white rtl:translate-x-1/2"
          >
            {t('pageOf', { page: current, total: pageCount })}
          </span>
        )}
      </div>
    </div>
  );
}
