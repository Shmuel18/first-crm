'use client';

import { useState } from 'react';

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
 * Drive-style document tile for the folder drill-in grid. Shows a real Drive
 * thumbnail for synced files (drive_file_id), falling back to a file-type icon
 * when the file isn't on Drive yet or the thumbnail can't load. Clicking opens
 * the existing preview modal.
 */
export function DocumentCard({ doc, onClick }: Props) {
  const [thumbFailed, setThumbFailed] = useState(false);
  // Drive's thumbnail endpoint is fetched browser-side, so it rides the user's
  // own Google session (next/image's server optimizer can't auth to Drive).
  const thumbUrl =
    doc.drive_file_id && !thumbFailed
      ? `https://drive.google.com/thumbnail?id=${doc.drive_file_id}&sz=w400`
      : null;
  const label = doc.category?.name_he ?? doc.file_name;

  return (
    <button
      type="button"
      onClick={() => onClick(doc)}
      title={doc.file_name}
      className="group text-start rounded-lg border border-neutral-200 bg-white overflow-hidden transition hover:border-brand-gold-text hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-neutral-100 bg-neutral-50">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Drive thumbnails must load browser-side with the user's Google session; next/image's server optimizer can't authenticate to Drive.
          <img
            src={thumbUrl}
            alt=""
            loading="lazy"
            onError={() => setThumbFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <FileTypeIcon mime={doc.mime_type} className="size-10 text-neutral-300" />
        )}
        <span className="absolute top-1.5 end-1.5">
          <DocumentStatusChip status={doc.status as DocumentStatus} size="sm" />
        </span>
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-xs font-medium text-neutral-900">{label}</p>
      </div>
    </button>
  );
}
