'use client';

import { useEffect, useState, useTransition } from 'react';

import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileQuestion,
  Loader2,
  RotateCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { deleteDocumentAction } from '../actions/delete-document';
import { getDocumentPreviewUrlAction } from '../actions/get-document-preview-url';
import { updateDocumentStatusAction } from '../actions/update-document-status';
import type { DocumentStatus, DocumentWithRelations } from '../types';
import { DocumentStatusChip } from './document-status-chip';

type Props = {
  doc: DocumentWithRelations | null;
  caseId: string;
  onClose: () => void;
};

export function DocumentPreviewModal({ doc, caseId, onClose }: Props) {
  const t = useTranslations('documents.previewModal');
  const tActions = useTranslations('documents.statusActions');
  const tErr = useTranslations('documents.errors');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!doc) return;
    setUrl(null);
    setError(null);
    // Drive-backed docs render via Drive iframe - no Supabase fetch needed
    if (doc.drive_file_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getDocumentPreviewUrlAction(doc.id)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setUrl(res.url);
        else setError(res.message ?? tErr('unauthorized'));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [doc, tErr]);

  if (!doc) return null;

  const status = doc.status as DocumentStatus;
  const dateLocale = locale === 'he' ? 'he-IL' : 'en-GB';
  const uploadDate = new Date(doc.upload_date).toLocaleDateString(dateLocale);

  const updateStatus = (next: DocumentStatus) =>
    startTransition(async () => {
      const res = await updateDocumentStatusAction(doc.id, caseId, next);
      if (!res.ok) setError(tErr('statusUpdateFailed'));
      else onClose();
    });

  const handleDeleteConfirmed = () =>
    startTransition(async () => {
      setConfirmDelete(false);
      const res = await deleteDocumentAction(doc.id, caseId);
      if (!res.ok) setError(tErr('deleteFailed'));
      else onClose();
    });

  const isImage = doc.mime_type?.startsWith('image/') ?? false;
  const isPdf = doc.mime_type === 'application/pdf';
  // Drive preview handles Word, Excel, PPT, PDF, images - everything.
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

        <div className="rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden min-h-[280px] max-h-[60vh] flex items-center justify-center">
          {loading && <Loader2 className="size-5 animate-spin text-neutral-400" aria-label="Loading" />}
          {!loading && error && (
            <p className="text-sm text-rose-600 px-4 py-6 text-center">{error}</p>
          )}
          {!loading && !error && drivePreviewUrl && (
            <iframe
              src={drivePreviewUrl}
              title={doc.file_name}
              className="w-full h-[58vh]"
              allow="autoplay"
            />
          )}
          {!loading && !error && !drivePreviewUrl && url && isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={doc.file_name} className="max-h-[58vh] object-contain" />
          )}
          {!loading && !error && !drivePreviewUrl && url && isPdf && (
            <iframe
              src={url}
              title={doc.file_name}
              className="w-full h-[58vh]"
            />
          )}
          {!loading && !error && !drivePreviewUrl && url && !isImage && !isPdf && (
            <div className="text-center text-neutral-500 px-4 py-12">
              <FileQuestion className="size-10 mx-auto mb-3 text-neutral-300" />
              <p className="text-sm">{t('noPreview')}</p>
            </div>
          )}
        </div>

        {(url || doc.drive_file_url) && (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={doc.drive_file_url ?? url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-600 hover:text-[#C9A961] transition"
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
                  className="inline-flex items-center gap-1.5 text-xs text-neutral-600 hover:text-[#C9A961] transition"
                >
                  <Download className="size-3" />
                  {t('downloadOriginal')}
                </a>
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-100">
          {status !== 'verified' && (
            <Button
              type="button"
              onClick={() => updateStatus('verified')}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-9"
            >
              <CheckCircle2 className="size-4 me-1" />
              {tActions('markVerified')}
            </Button>
          )}
          {status !== 'new' && status !== 'rejected' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => updateStatus('new')}
              disabled={isPending}
              className="h-9"
            >
              <RotateCw className="size-4 me-1" />
              {tActions('markNew')}
            </Button>
          )}
          {status !== 'not_relevant' && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => updateStatus('not_relevant')}
              disabled={isPending}
              className="h-9"
            >
              <XCircle className="size-4 me-1" />
              {tActions('markNotRelevant')}
            </Button>
          )}

          <div className="flex-1" />

          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
            disabled={isPending}
            className="h-9"
          >
            <Trash2 className="size-4 me-1" />
            {tCommon('delete')}
          </Button>
        </div>
      </DialogContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogTitle>{tCommon('delete')}</AlertDialogTitle>
          <AlertDialogDescription>{t('deleteConfirm')}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel
              render={
                <Button type="button" variant="ghost" className="h-10">
                  {tCommon('cancel')}
                </Button>
              }
            />
            <AlertDialogAction
              render={
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteConfirmed}
                  disabled={isPending}
                  className="h-10"
                >
                  {tCommon('delete')}
                </Button>
              }
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
