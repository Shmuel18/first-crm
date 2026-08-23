'use client';

import { useState } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { PdfPageCanvas } from './pdf-page-canvas';

type Props = {
  src: string;
  fileName: string;
};

/**
 * Paged PDF view for the preview modal. The canvas draws one page at a time —
 * that is the price of not using the browser's embedded viewer, which does not
 * exist on Android and barely works on iOS — so the page controls that the
 * desktop viewer used to provide have to come from us.
 */
export function PdfPageViewer({ src, fileName }: Props) {
  const t = useTranslations('documents.previewModal');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);

  const go = (delta: number): void =>
    setPage((current) => Math.min(Math.max(current + delta, 1), pageCount));

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="max-h-[52vh] w-full overflow-auto">
        <PdfPageCanvas
          key={`${src}#${page}`}
          src={src}
          pageNumber={page}
          width={900}
          onPageCount={setPageCount}
          className="min-h-[240px] w-full"
        />
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
