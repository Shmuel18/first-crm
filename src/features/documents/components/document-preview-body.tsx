'use client';

import { FileQuestion, Loader2, RotateCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

type Props = {
  loading: boolean;
  error: string | null;
  /** Drive's hosted preview URL (handles Word/Excel/PDF/images uniformly).
   *  Takes precedence over the Supabase signed URL when both are available. */
  drivePreviewUrl: string | null;
  /** Supabase Storage signed URL fallback. Used when there's no Drive file
   *  (manual upload not yet mirrored) or for in-app inline image preview. */
  url: string | null;
  fileName: string;
  isImage: boolean;
  isPdf: boolean;
  /** Re-fetch the Supabase signed URL. Hidden when a Drive file exists
   *  because Drive previews don't depend on our signed URL. */
  onRetry: () => void;
};

/**
 * The visual preview slot inside <DocumentPreviewModal>. Picks the right
 * renderer (Drive iframe → image → PDF iframe → "no preview" notice) based
 * on what the parent has resolved. Separate component so the modal file
 * stays under the size limit and so the renderer matrix is testable.
 */
export function DocumentPreviewBody({
  loading,
  error,
  drivePreviewUrl,
  url,
  fileName,
  isImage,
  isPdf,
  onRetry,
}: Props) {
  const t = useTranslations('documents.previewModal');
  const tError = useTranslations('error');

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden min-h-[280px] max-h-[60vh] flex items-center justify-center">
      {loading && (
        <Loader2 className="size-5 animate-spin text-neutral-400" aria-label="Loading" />
      )}
      {!loading && error && (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-rose-600">{error}</p>
          {!url && !drivePreviewUrl && (
            <Button type="button" variant="outline" onClick={onRetry} className="mt-3 h-8">
              <RotateCw className="size-3.5 me-1" />
              {tError('retry')}
            </Button>
          )}
        </div>
      )}
      {!loading && !error && drivePreviewUrl && (
        <iframe
          src={drivePreviewUrl}
          title={fileName}
          className="w-full h-[58vh]"
          allow="autoplay"
        />
      )}
      {!loading && !error && !drivePreviewUrl && url && isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={fileName} className="max-h-[58vh] object-contain" />
      )}
      {!loading && !error && !drivePreviewUrl && url && isPdf && (
        <iframe src={url} title={fileName} className="w-full h-[58vh]" />
      )}
      {!loading && !error && !drivePreviewUrl && url && !isImage && !isPdf && (
        <div className="text-center text-neutral-500 px-4 py-12">
          <FileQuestion className="size-10 mx-auto mb-3 text-neutral-300" />
          <p className="text-sm">{t('noPreview')}</p>
        </div>
      )}
    </div>
  );
}
