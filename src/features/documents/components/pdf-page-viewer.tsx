'use client';

import { useState } from 'react';

import { ChevronLeft, ChevronRight, FileQuestion } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { PdfPageCanvas } from './pdf-page-canvas';

type Props = {
  src: string;
  fileName: string;
  /** Google-rasterized image of the first page (Drive-synced docs only).
   *  pdf.js reverses and mis-spaces Hebrew in PDFs without embedded fonts —
   *  which is what the banks send — while Drive's own renderer draws them
   *  correctly, so when this image exists it covers the canvas on page 1. */
  driveImageSrc?: string | null;
};

type DriveImageState = 'loading' | 'shown' | 'failed';

/**
 * Paged PDF view for the preview modal. The canvas draws one page at a time —
 * that is the price of not using the browser's embedded viewer, which does not
 * exist on Android and barely works on iOS — so the page controls that the
 * desktop viewer used to provide have to come from us.
 */
export function PdfPageViewer({ src, fileName, driveImageSrc }: Props) {
  const t = useTranslations('documents.previewModal');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [driveImage, setDriveImage] = useState<DriveImageState>('loading');

  const go = (delta: number): void =>
    setPage((current) => Math.min(Math.max(current + delta, 1), pageCount));

  const driveImageShown =
    Boolean(driveImageSrc) && page === 1 && driveImage === 'shown';

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="relative max-h-[52vh] w-full overflow-auto">
        {driveImageSrc && page === 1 && driveImage !== 'failed' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={driveImageSrc}
            alt={fileName}
            onLoad={() => setDriveImage('shown')}
            onError={() => setDriveImage('failed')}
            className={driveImageShown ? 'block w-full' : 'absolute size-0 opacity-0'}
          />
        )}
        {/* The canvas keeps rendering underneath even when the Drive image
            covers it — it is what reports the page count for the pager, and
            the instant fallback if the image errors. Kept in layout (not
            display:none) so pdf.js's render task can complete. */}
        <div
          className={
            driveImageShown ? 'absolute size-0 overflow-hidden opacity-0' : undefined
          }
        >
          <PdfPageCanvas
            key={`${src}#${page}`}
            src={src}
            pageNumber={page}
            width={900}
            onPageCount={setPageCount}
            fallback={
              driveImageShown ? null : (
                <div className="px-4 py-12 text-center text-neutral-500">
                  <FileQuestion
                    className="mx-auto mb-3 size-10 text-neutral-300"
                    aria-hidden="true"
                  />
                  <p className="text-sm">{t('noPreview')}</p>
                </div>
              )
            }
            className="min-h-[240px] w-full"
          />
        </div>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center gap-3 pb-1 text-xs text-neutral-600">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={page <= 1}
            aria-label={t('previousPage')}
            className="rounded p-1 transition hover:bg-neutral-100 disabled:opacity-40"
          >
            <ChevronRight className="size-4 ltr:rotate-180" aria-hidden="true" />
          </button>
          <span aria-live="polite">{t('pageOf', { page, total: pageCount })}</span>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={page >= pageCount}
            aria-label={t('nextPage')}
            className="rounded p-1 transition hover:bg-neutral-100 disabled:opacity-40"
          >
            <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden="true" />
          </button>
          <span className="sr-only">{fileName}</span>
        </div>
      )}
    </div>
  );
}
