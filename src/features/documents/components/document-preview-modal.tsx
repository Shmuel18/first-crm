'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { useLocale, useTranslations } from 'next-intl';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { callAction } from '@/lib/actions/call-action';
import { parseLocale } from '@/lib/i18n/direction';
import { retryViaJsonTransport, saveBlob } from '@/lib/utils/file-download';
import { formatDateShort } from '@/lib/utils/format-date';

import { deleteDocumentAction } from '../actions/delete-document';
import { getDocumentPreviewUrlAction } from '../actions/get-document-preview-url';
import { isAttachable } from '../domain/attachable';
import { markDriveOpened } from '../domain/drive-open-signal';
import { documentDownloadName, isDocumentDownloadable } from '../domain/google-native-download';
import { isInlineRenderable } from '../domain/inline-renderable';
import { usePrintDocument } from '../hooks/use-print-document';
import type { DocumentWithRelations } from '../types';

import { DocumentPreviewActions } from './document-preview-actions';
import { SendDocumentsEmailDialog } from './send-documents-email-dialog';
import { DocumentPreviewBody } from './document-preview-body';
import { DocumentPreviewLinks } from './document-preview-links';
import { DocumentTitleEditor } from './document-title-editor';

type Props = {
  doc: DocumentWithRelations | null;
  caseId: string;
  canDeleteDocuments: boolean;
  /** Enables "send by email" for this document; mirrors can_edit_case. */
  canSendEmail: boolean;
  /** Prefill for the email recipient (the client), freely overwritten. */
  defaultEmailRecipient: string | null;
  /** AI draft-assist inside the compose dialog (flag + permission). */
  aiDraftEnabled: boolean;
  onClose: () => void;
};

export function DocumentPreviewModal({
  doc,
  caseId,
  canDeleteDocuments,
  canSendEmail,
  defaultEmailRecipient,
  aiDraftEnabled,
  onClose,
}: Props) {
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
  const [emailOpen, setEmailOpen] = useState(false);
  // Local so a rename shows immediately; the action revalidates the case page
  // behind it. Seeded per mount (the parent keys this modal by document id).
  const [fileName, setFileName] = useState(doc?.file_name ?? '');
  const [downloading, setDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const { printing, failed: printFailed, printBlob, printBytes, markFailed } = usePrintDocument();

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

  const handleDeleteConfirmed = () =>
    startTransition(async () => {
      setConfirmDelete(false);
      if (!canDeleteDocuments) {
        setError(tErr('unauthorized'));
        return;
      }
      const res = await callAction(() => deleteDocumentAction(doc.id, caseId));
      if (!res.ok) {
        setError(res.error === 'unauthorized' ? tErr('unauthorized') : tErr('deleteFailed'));
      } else {
        onClose();
        router.refresh(); // action no longer re-renders the heavy grid into the response
      }
    });

  // Printing pulls the bytes from OUR route, whichever side holds them. The
  // signed Storage URL used to be the fast path, but it is a third-party
  // request: in the office it is slow or eaten by the content filter, which is
  // what made printing take several clicks to do anything. Office formats have
  // no browser renderer and still open in Drive, which prints them itself.
  // What the route will actually serve inline — not merely "is a PDF/image".
  // An image type outside that allowlist comes back as octet-stream, which an
  // <img>/<iframe> renders as a broken tile.
  const renderable = isInlineRenderable(doc.mime_type);
  // Print reads through the route, which resolves Storage or Drive by itself,
  // so it no longer depends on the signed URL having arrived.
  const canPrintInApp = renderable;
  const printFallbackUrl = doc.drive_file_url;
  const openInDrive = () => {
    if (!printFallbackUrl) return;
    // Programmatic open — the page's capture-phase link listener cannot see it.
    markDriveOpened(doc.case_id);
    window.open(printFallbackUrl, '_blank', 'noopener,noreferrer');
  };
  const handlePrint = () => {
    if (!canPrintInApp) {
      openInDrive();
      return;
    }
    startTransition(async () => {
      const endpoint = `/api/documents/${encodeURIComponent(doc.id)}/download`;
      try {
        const res = await fetch(endpoint, { cache: 'no-store' });
        if (res.ok) {
          printBlob(await res.blob(), doc.mime_type);
          return;
        }
      } catch (err) {
        console.error('[documentPrint] direct fetch failed', err);
      }
      // Blocked or unavailable → the same route through the base64 envelope
      // (the shape the office filter lets through), then Drive's viewer.
      try {
        const res = await fetch(`${endpoint}?transport=json`, { cache: 'no-store' });
        const body = res.ok
          ? ((await res.json()) as { ok?: boolean; base64?: string; mimeType?: string })
          : null;
        if (body?.ok && body.base64) {
          // The document's own mime decides how the frame renders it; the
          // envelope's is only a transport detail.
          printBytes(body.base64, doc.mime_type ?? body.mimeType ?? 'application/pdf');
          return;
        }
      } catch (err) {
        console.error('[documentPrint] json transport failed', err);
      }
      // Nothing left to try: say so rather than looking like a dead button.
      if (printFallbackUrl) openInDrive();
      else markFailed();
    });
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadFailed(false);
    const endpoint = `/api/documents/${encodeURIComponent(doc.id)}/download`;
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (response.ok) {
        saveBlob(await response.blob(), documentDownloadName(fileName, doc.mime_type));
        return;
      }
      // Our handler answers errors as JSON; anything else is the office content
      // filter's block page, which the base64 envelope gets past.
      const fromUs = response.headers.get('Content-Type')?.includes('application/json') === true;
      if (!fromUs && (await retryViaJsonTransport(endpoint))) return;
      throw new Error(`download ${response.status}`);
    } catch (err) {
      console.error('[documentDownload] failed', err);
      if (await retryViaJsonTransport(endpoint)) return;
      setDownloadFailed(true);
    } finally {
      setDownloading(false);
    }
  };

  const canEmailThisDoc = canSendEmail && isAttachable(doc);
  const canDownloadThisDoc = isDocumentDownloadable(doc);

  const isImage = doc.mime_type?.startsWith('image/') ?? false;
  const isPdf = doc.mime_type === 'application/pdf';
  // Drive preview handles Word, Excel, PPT, PDF, images — everything.
  // Falls back to Supabase signed URL for files not in Drive yet.
  // Anything the browser renders itself is previewed from OUR origin — the
  // download route streams it, whether the bytes live in Storage or in Drive.
  // Embedding Drive's viewer needs third-party cookies, which Safari blocks
  // outright: on an iPhone the preview was a Google "allow cookies" wall that
  // the user cannot get past. Office formats have no in-browser renderer, so
  // they still fall back to Drive's viewer.
  const ownPreviewUrl = renderable ? `/api/documents/${encodeURIComponent(doc.id)}/download` : null;
  const drivePreviewUrl = doc.drive_file_id
    ? `https://drive.google.com/file/d/${doc.drive_file_id}/preview`
    : null;
  // Drive-synced PDFs: Google's rasterization of the first page. pdf.js
  // reverses/mis-spaces Hebrew when the PDF (typically a bank's) has no
  // embedded fonts; Drive's renderer draws it the way Drive itself shows it.
  const drivePdfImageSrc =
    isPdf && doc.drive_file_id && ownPreviewUrl ? `${ownPreviewUrl}?thumb=1&size=1600` : null;

  return (
    <Dialog open={Boolean(doc)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            <DocumentTitleEditor
              documentId={doc.id}
              caseId={caseId}
              fileName={fileName}
              canRename={canSendEmail}
              onRenamed={setFileName}
            />
          </DialogTitle>
          {/* The category used to sit here next to the file name, which read as
              the document having two different names. The folder already says
              which category this is. */}
          <DialogDescription className="pt-1">{uploadDate}</DialogDescription>
        </DialogHeader>

        <DocumentPreviewBody
          // Our own preview needs no signed URL, so it must not wait on that
          // fetch — nor be hidden when it fails (it only feeds print/download).
          loading={ownPreviewUrl ? false : loading}
          error={ownPreviewUrl ? null : error}
          drivePreviewUrl={ownPreviewUrl ? null : drivePreviewUrl}
          url={ownPreviewUrl ?? url}
          fileName={fileName}
          isImage={isImage}
          isPdf={isPdf}
          drivePdfImageSrc={drivePdfImageSrc}
          onDrivePreviewFocus={() => markDriveOpened(doc.case_id)}
          onRetry={handleRetry}
        />

        <DocumentPreviewLinks
          url={url}
          driveFileUrl={doc.drive_file_url}
          showPrint={canPrintInApp || Boolean(printFallbackUrl)}
          // isPending covers the Drive round-trip before the dialog appears.
          printing={printing || isPending}
          printFailed={printFailed}
          showDownload={canDownloadThisDoc}
          downloading={downloading}
          downloadFailed={downloadFailed}
          showEmail={canEmailThisDoc}
          onPrint={handlePrint}
          onDownload={() => void handleDownload()}
          onEmail={() => setEmailOpen(true)}
        />

        <DocumentPreviewActions
          pending={isPending}
          canDeleteDocuments={canDeleteDocuments}
          confirmDeleteOpen={confirmDelete}
          onConfirmDeleteOpenChange={setConfirmDelete}
          onDeleteConfirmed={handleDeleteConfirmed}
        />

        {emailOpen && (
          <SendDocumentsEmailDialog
            caseId={caseId}
            open={emailOpen}
            onOpenChange={setEmailOpen}
            defaultRecipient={defaultEmailRecipient}
            aiDraftEnabled={aiDraftEnabled}
            initialAttachments={[
              {
                kind: 'document',
                id: doc.id,
                fileName,
                fileSize: doc.file_size,
              },
            ]}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
