'use client';

import { FileText, FileType2, Image as ImageIcon } from 'lucide-react';

import type { DocumentStatus, DocumentWithRelations } from '../types';
import { DocumentStatusChip } from './document-status-chip';

type Props = {
  doc: DocumentWithRelations;
  /** Supabase Storage signed URL for an inline thumbnail. Preferred over the
   *  Drive iframe when present — it works for every permitted user without a
   *  Google session. Resolved by useDocumentPreviews for image/PDF docs. */
  previewUrl?: string | null;
  onClick: (doc: DocumentWithRelations) => void;
};

function FileTypeIcon({ mime, className }: { mime: string | null; className?: string }) {
  if (mime?.startsWith('image/')) return <ImageIcon className={className} />;
  if (mime === 'application/pdf') return <FileText className={className} />;
  return <FileType2 className={className} />;
}

/**
 * Drive-style document tile with an inline preview so the file is recognizable
 * without opening it. Renderer precedence:
 *   1. Supabase signed URL (image → <img>, PDF → <iframe>) — the reliable path
 *      for uploaded docs; identical to what the preview modal shows.
 *   2. Google Drive `/preview` iframe — for files only mirrored to Drive
 *      (e.g. Office docs found by sync) with no local blob to sign.
 *   3. File-type icon — nothing to preview yet.
 * The preview is non-interactive; a transparent overlay keeps the whole tile
 * clickable to open the full modal.
 */
export function DocumentCard({ doc, previewUrl, onClick }: Props) {
  const label = doc.category?.name_he ?? doc.file_name;
  const isImage = doc.mime_type?.startsWith('image/') ?? false;
  const isPdf = doc.mime_type === 'application/pdf';
  const driveUrl = doc.drive_file_id
    ? `https://drive.google.com/file/d/${doc.drive_file_id}/preview`
    : null;

  return (
    <div className="group relative overflow-hidden rounded-lg border border-neutral-200 bg-white transition hover:border-brand-gold-text hover:shadow-md focus-within:ring-2 focus-within:ring-brand-gold-text/50">
      <div className="relative aspect-[4/3] overflow-hidden border-b border-neutral-100 bg-neutral-50">
        {previewUrl && isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={label}
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        ) : previewUrl && isPdf ? (
          <iframe
            src={previewUrl}
            title={doc.file_name}
            loading="lazy"
            tabIndex={-1}
            className="pointer-events-none absolute inset-0 size-full border-0"
          />
        ) : driveUrl ? (
          <iframe
            src={driveUrl}
            title={doc.file_name}
            loading="lazy"
            tabIndex={-1}
            className="pointer-events-none absolute inset-0 size-full border-0"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <FileTypeIcon mime={doc.mime_type} className="size-10 text-neutral-300" />
          </div>
        )}
        <span className="absolute top-1.5 end-1.5 z-10">
          <DocumentStatusChip status={doc.status as DocumentStatus} size="sm" />
        </span>
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-xs font-medium text-neutral-900">{label}</p>
      </div>
      {/* Transparent click target over the whole tile — the preview is
          non-interactive, so clicking anywhere opens the full modal. */}
      <button
        type="button"
        onClick={() => onClick(doc)}
        title={doc.file_name}
        aria-label={label}
        className="absolute inset-0 z-20 focus:outline-none"
      />
    </div>
  );
}
