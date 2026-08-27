'use client';

import { FileQuestion, Loader2, RotateCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import { PdfPageViewer } from './pdf-page-viewer';

type Props = {
  loading: boolean;
  error: string | null;
  /** Drive's hosted viewer. Only for formats no browser can render (Word,
   *  Excel) — it needs third-party cookies, which Safari refuses, so it is a
   *  last resort rather than the default it used to be. */
  drivePreviewUrl: string | null;
  /** Same-origin bytes from /api/documents/[id]/download for anything the
   *  browser renders itself; the signed Storage URL only when the caller has
   *  nothing better. */
  url: string | null;
  fileName: string;
  isImage: boolean;
  isPdf: boolean;
  /** Google-rendered first page for Drive-synced PDFs (correct Hebrew where
   *  pdf.js garbles non-embedded bank fonts). */
  drivePdfImageSrc: string | null;
  /** Cross-origin iframe clicks are invisible to the page-level listener. */
  onDrivePreviewFocus?: () => void;
  /** Re-fetch the Supabase signed URL. Hidden when a Drive file exists
   *  because Drive previews don't depend on our signed URL. */
  onRetry: () => void;
};

/**
 * The visual preview slot inside <DocumentPreviewModal>. Picks the renderer
 * from what the parent resolved: our own bytes for images and PDFs, Drive's
 * viewer only for Office formats, and a "no preview" notice otherwise.
 * Separate component so the modal file stays under the size limit and so the
 * renderer matrix is testable.
 */
export function DocumentPreviewBody({
  loading,
  error,
  drivePreviewUrl,
  url,
  fileName,
  isImage,
  isPdf,
  drivePdfImageSrc,
  onDrivePreviewFocus,
  onRetry,
}: Props) {
  const t = useTranslations('documents.previewModal');
  const tError = useTranslations('error');

  return (
    <div className="flex max-h-[60vh] min-h-[280px] items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
      {loading && <Loader2 className="size-5 animate-spin text-neutral-400" aria-label="Loading" />}
      {!loading && error && (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-rose-600">{error}</p>
          {!url && !drivePreviewUrl && (
            <Button type="button" variant="outline" onClick={onRetry} className="mt-3 h-8">
              <RotateCw className="me-1 size-3.5" />
              {tError('retry')}
            </Button>
          )}
        </div>
      )}
      {!loading && !error && drivePreviewUrl && (
        <iframe
          src={drivePreviewUrl}
          title={fileName}
          className="h-[58vh] w-full"
          allow="autoplay"
          onFocus={onDrivePreviewFocus}
        />
      )}
      {!loading && !error && !drivePreviewUrl && url && isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={fileName} className="max-h-[58vh] object-contain" />
      )}
      {!loading && !error && !drivePreviewUrl && url && isPdf && (
        <PdfPageViewer src={url} fileName={fileName} driveImageSrc={drivePdfImageSrc} />
      )}
      {!loading && !error && !drivePreviewUrl && url && !isImage && !isPdf && (
        <div className="px-4 py-12 text-center text-neutral-500">
          <FileQuestion className="mx-auto mb-3 size-10 text-neutral-300" />
          <p className="text-sm">{t('noPreview')}</p>
        </div>
      )}
    </div>
  );
}
