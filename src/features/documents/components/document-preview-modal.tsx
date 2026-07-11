'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { Download, ExternalLink } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { parseLocale } from '@/lib/i18n/direction';
import { formatDateShort } from '@/lib/utils/format-date';

import { deleteDocumentAction } from '../actions/delete-document';
import { getDocumentPreviewUrlAction } from '../actions/get-document-preview-url';
import { updateDocumentStatusAction } from '../actions/update-document-status';
import type { DocumentStatus, DocumentWithRelations } from '../types';

import { DocumentPreviewActions } from './document-preview-actions';
import { DocumentPreviewBody } from './document-preview-body';
import { DocumentStatusChip } from './document-status-chip';

type Props = {
  doc: DocumentWithRelations | null;
  caseId: string;
  canDeleteDocuments: boolean;
  canVerifyDocuments: boolean;
  onClose: () => void;
};

export function DocumentPreviewModal({
  doc,
  caseId,
  canDeleteDocuments,
  canVerifyDocuments,
  onClose,
}: Props) {
  const t = useTranslations('documents.previewModal');
  const tErr = useTranslations('documents.errors');
  const locale = parseLocale(useLocale());
  const [url, setUrl] = useState<string | null>(null);
  // Initial loading is derived from doc: only true if we'll actually fetch
  // a signed URL (i.e., this is a Supabase-only doc, not a Drive iframe one).
  // Using an initializer instead of setLoading(true) inside an effect avoids
  // react-hooks/set-state-in-effect.
  const [loading, setLoading] = useState<boolean>(() => Boolean(doc && !doc.drive_file_id));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    // Parent uses `key={doc?.id ?? 'none'}` so each preview mounts fresh -
    // we don't need to clear url/error on doc change here, and starting the
    // fetch in async callbacks (.then / .finally) sidesteps the
    // set-state-in-effect rule.
    if (!doc || doc.drive_file_id) return;
    let cancelled = false;
    getDocumentPreviewUrlAction(doc.id)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setUrl(res.url);
        else setError(tErr('unauthorized'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // tErr excluded - re-fetching on locale change would be wasteful and
    // the fallback string is only used on failure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  if (!doc) return null;

  const status = doc.status as DocumentStatus;
  const uploadDate = formatDateShort(doc.upload_date, locale);

  const handleRetry = () => {
    if (doc.drive_file_id) return;
    setError(null);
    setLoading(true);
    getDocumentPreviewUrlAction(doc.id)
      .then((res) => {
        if (res.ok) setUrl(res.url);
        else setError(tErr('unauthorized'));
      })
      .finally(() => setLoading(false));
  };

  const updateStatus = (next: DocumentStatus) =>
    startTransition(async () => {
      if (!canVerifyDocuments) {
        setError(tErr('unauthorized'));
        return;
      }
      const res = await updateDocumentStatusAction(doc.id, caseId, next);
      if (!res.ok) {
        setError(res.error === 'unauthorized' ? tErr('unauthorized') : tErr('statusUpdateFailed'));
      } else {
        onClose();
        router.refresh(); // action no longer re-renders the heavy grid into the response
      }
    });

  const handleDeleteConfirmed = () =>
    startTransition(async () => {
      setConfirmDelete(false);
      if (!canDeleteDocuments) {
        setError(tErr('unauthorized'));
        return;
      }
      const res = await deleteDocumentAction(doc.id, caseId);
      if (!res.ok) {
        setError(res.error === 'unauthorized' ? tErr('unauthorized') : tErr('deleteFailed'));
      } else {
        onClose();
        router.refresh(); // action no longer re-renders the heavy grid into the response
      }
    });

  const isImage = doc.mime_type?.startsWith('image/') ?? false;
  const isPdf = doc.mime_type === 'application/pdf';
  // Drive preview handles Word, Excel, PPT, PDF, images — everything.
  // Falls back to Supabase signed URL for files not in Drive yet.
  const drivePreviewUrl = doc.drive_file_id
    ? `https://drive.google.com/file/d/${doc.drive_file_id}/preview`
    : null;

  return (
    <Dialog open={Boolean(doc)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{doc.file_name}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
            <DocumentStatusChip status={status} size="sm" />
            {doc.category && <span>{doc.category.name_he}</span>}
            <span className="text-neutral-400">·</span>
            <span>{uploadDate}</span>
          </DialogDescription>
        </DialogHeader>

        <DocumentPreviewBody
          loading={loading}
          error={error}
          drivePreviewUrl={drivePreviewUrl}
          url={url}
          fileName={doc.file_name}
          isImage={isImage}
          isPdf={isPdf}
          onRetry={handleRetry}
        />

        {(url || doc.drive_file_url) && (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={doc.drive_file_url ?? url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-700 hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 rounded transition"
            >
              <ExternalLink className="size-3" />
              {t('openNewTab')}
            </a>
            {url && (
              <>
                <span className="text-neutral-300">·</span>
                <a
                  href={url}
                  download={doc.file_name}
                  className="inline-flex items-center gap-1.5 text-xs text-neutral-700 hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 rounded transition"
                >
                  <Download className="size-3" />
                  {t('downloadOriginal')}
                </a>
              </>
            )}
          </div>
        )}

        <DocumentPreviewActions
          status={status}
          pending={isPending}
          canDeleteDocuments={canDeleteDocuments}
          canVerifyDocuments={canVerifyDocuments}
          onUpdateStatus={updateStatus}
          confirmDeleteOpen={confirmDelete}
          onConfirmDeleteOpenChange={setConfirmDelete}
          onDeleteConfirmed={handleDeleteConfirmed}
        />
      </DialogContent>
    </Dialog>
  );
}
