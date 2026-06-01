'use client';

import { FileText, FileType2, Image as ImageIcon } from 'lucide-react';

import type { DocumentStatus, DocumentWithRelations } from '../types';
import { DocumentStatusChip } from './document-status-chip';

type Props = {
  doc: DocumentWithRelations;
  onClick: (doc: DocumentWithRelations) => void;
};

function FileTypeIcon({ mime, className }: { mime: string | null; className?: string }) {
  if (mime?.startsWith('image/')) return <ImageIcon className={className} />;
  if (mime === 'application/pdf') return <FileText className={className} />;
  return <FileType2 className={className} />;
}

/**
 * Drive-style document tile. Shows the real document preview inline using the
 * same Drive `/preview` iframe the preview modal uses — an iframe carries the
 * user's Drive session, so it renders where a cross-site `<img>` thumbnail is
 * blocked by third-party-cookie policies. Falls back to a file-type icon for
 * documents not yet mirrored to Drive. The iframe is non-interactive; a
 * transparent overlay keeps the whole tile clickable to open the full modal.
 */
export function DocumentCard({ doc, onClick }: Props) {
  const label = doc.category?.name_he ?? doc.file_name;
  const previewUrl = doc.drive_file_id
    ? `https://drive.google.com/file/d/${doc.drive_file_id}/preview`
    : null;

  return (
    <div className="group relative overflow-hidden rounded-lg border border-neutral-200 bg-white transition hover:border-brand-gold-text hover:shadow-md focus-within:ring-2 focus-within:ring-brand-gold-text/50">
      <div className="relative aspect-[4/3] overflow-hidden border-b border-neutral-100 bg-neutral-50">
        {previewUrl ? (
          <iframe
            src={previewUrl}
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
      {/* Transparent click target over the whole tile — the preview iframe is
          pointer-events-none, so clicking anywhere opens the full modal. */}
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
