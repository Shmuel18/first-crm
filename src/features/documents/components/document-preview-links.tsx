'use client';

import { Download, ExternalLink, Mail, Printer } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  /** Signed Storage URL — enables the download link. */
  url: string | null;
  /** Drive link for the file, when it has one. */
  driveFileUrl: string | null;
  fileName: string;
  showPrint: boolean;
  printing: boolean;
  printFailed: boolean;
  showEmail: boolean;
  onPrint: () => void;
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
  fileName,
  showPrint,
  printing,
  printFailed,
  showEmail,
  onPrint,
  onEmail,
}: Props) {
  const t = useTranslations('documents.previewModal');
  const tErr = useTranslations('documents.errors');
  const linkClass =
    'inline-flex items-center gap-1.5 text-xs text-neutral-700 hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 rounded transition';

  if (!url && !driveFileUrl) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={driveFileUrl ?? url ?? '#'} target="_blank" rel="noopener noreferrer" className={linkClass}>
        <ExternalLink className="size-3" />
        {t('openNewTab')}
      </a>
      {showPrint && (
        <>
          <span className="text-neutral-300">·</span>
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
      {showEmail && (
        <>
          <span className="text-neutral-300">·</span>
          <button type="button" onClick={onEmail} className={linkClass}>
            <Mail className="size-3" />
            {t('sendByEmail')}
          </button>
        </>
      )}
      {url && (
        <>
          <span className="text-neutral-300">·</span>
          <a href={url} download={fileName} className={linkClass}>
            <Download className="size-3" />
            {t('downloadOriginal')}
          </a>
        </>
      )}
      {printFailed && <span className="w-full text-xs text-rose-700">{tErr('printFailed')}</span>}
    </div>
  );
}
