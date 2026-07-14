'use client';

import { Download, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DocumentPreviewBody } from '@/features/documents/components/document-preview-body';

import { isAudioMime } from '../domain/recording';

import { TaskAudioPlayer } from './task-audio-player';

type Props = {
  url: string;
  fileName: string;
  mimeType: string | null;
  /** Drive webViewLink, when the file is mirrored to the office Drive. */
  driveUrl: string | null;
  onClose: () => void;
};

/**
 * Inline preview (PDF iframe / image) for a file attached to a task, so it can
 * be read without downloading it first. Reuses the documents-feature preview
 * body, but always feeds it the Supabase signed URL (never the Drive iframe) so
 * any task viewer sees it without an office Google session. Types the browser
 * can't render fall back to the download link.
 */
export function TaskDocPreviewDialog({ url, fileName, mimeType, driveUrl, onClose }: Props) {
  const t = useTranslations('documents.previewModal');
  const isAudio = isAudioMime(mimeType);
  const isImage = mimeType?.startsWith('image/') ?? false;
  const isPdf = mimeType === 'application/pdf';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{fileName}</DialogTitle>
          <DialogDescription className="sr-only">{fileName}</DialogDescription>
        </DialogHeader>

        {isAudio ? (
          // Audio stays tasks-only — play inline without touching the shared
          // documents preview body.
          <TaskAudioPlayer src={url} />
        ) : (
          <DocumentPreviewBody
            loading={false}
            error={null}
            drivePreviewUrl={null}
            url={url}
            fileName={fileName}
            isImage={isImage}
            isPdf={isPdf}
            onRetry={() => undefined}
          />
        )}

        <div className="flex flex-wrap items-center gap-4">
          {driveUrl && (
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded text-xs text-neutral-700 transition hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
            >
              <ExternalLink className="size-3" />
              {t('openInDrive')}
            </a>
          )}
          <a
            href={url}
            download={fileName}
            className="inline-flex items-center gap-1.5 rounded text-xs text-neutral-700 transition hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
          >
            <Download className="size-3" />
            {t('downloadOriginal')}
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
