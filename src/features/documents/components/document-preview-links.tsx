'use client';

import { Download, ExternalLink, Loader2, Mail, Printer } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  /** Signed Storage URL used for opening the preview in a new tab. */
  url: string | null;
  /** Drive link for the file, when it has one. */
  driveFileUrl: string | null;
  showPrint: boolean;
  printing: boolean;
  printFailed: boolean;
  showDownload: boolean;
  downloading: boolean;
  downloadFailed: boolean;
  showEmail: boolean;
  onPrint: () => void;
  onDownload: () => void;
  onEmail: () => void;
};

/**
 * The "what can I do with this file" row under the preview: open, print,
 * email, download. Split out of the modal to keep it under the size limit —
 * the modal owns the state, this only renders and delegates.
 */
export function DocumentPreviewLinks({
  url,
  driveFileUrl,
  showPrint,
  printing,
  printFailed,
  showDownload,
  downloading,
  downloadFailed,
  showEmail,
  onPrint,
  onDownload,
  onEmail,
}: Props) {
  const t = useTranslations('documents.previewModal');
  const tErr = useTranslations('documents.errors');
  const linkClass =
    'inline-flex items-center gap-1.5 text-xs text-neutral-700 hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 rounded transition';

  const hasOpenLink = Boolean(url || driveFileUrl);
  if (!hasOpenLink && !showPrint && !showDownload && !showEmail) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasOpenLink && (
        <a
          href={driveFileUrl ?? url ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          <ExternalLink className="size-3" />
          {t('openNewTab')}
        </a>
      )}
      {showPrint && (
        <>
          {hasOpenLink && <span className="text-neutral-300">·</span>}
          <button
            type="button"
            onClick={onPrint}
            disabled={printing}
            className={`${linkClass} disabled:opacity-50`}
          >
            <Printer className="size-3" />
            {t('print')}
          </button>
        </>
      )}
      {showDownload && (
        <>
          {(hasOpenLink || showPrint) && <span className="text-neutral-300">·</span>}
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            aria-busy={downloading}
            className={`${linkClass} disabled:opacity-50`}
          >
            {downloading ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-3" aria-hidden="true" />
            )}
            {downloading ? t('downloading') : t('downloadOriginal')}
          </button>
        </>
      )}
      {showEmail && (
        <>
          {(hasOpenLink || showPrint || showDownload) && (
            <span className="text-neutral-300">·</span>
          )}
          <button type="button" onClick={onEmail} className={linkClass}>
            <Mail className="size-3" />
            {t('sendByEmail')}
          </button>
        </>
      )}
      {printFailed && <span className="w-full text-xs text-rose-700">{tErr('printFailed')}</span>}
      {downloadFailed && (
        <span className="w-full text-xs text-rose-700">{tErr('downloadFailed')}</span>
      )}
    </div>
  );
}
