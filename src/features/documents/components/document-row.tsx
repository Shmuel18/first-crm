'use client';

import { FileText, Image as ImageIcon, FileType2, User2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import type { DocumentStatus, DocumentWithRelations } from '../types';
import { DocumentStatusChip } from './document-status-chip';

type Props = {
  doc: DocumentWithRelations;
  onClick: (doc: DocumentWithRelations) => void;
};

function fileIcon(mime: string | null) {
  if (!mime) return FileType2;
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime === 'application/pdf') return FileText;
  return FileType2;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentRow({ doc, onClick }: Props) {
  const tc = useTranslations('documents.card');
  const Icon = fileIcon(doc.mime_type);
  const borrowerName = doc.borrower
    ? [doc.borrower.first_name, doc.borrower.last_name].filter(Boolean).join(' ')
    : tc('borrowerGeneral');

  return (
    <button
      type="button"
      onClick={() => onClick(doc)}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-start',
        'hover:bg-neutral-50 active:bg-neutral-100 transition-colors',
        'border border-transparent hover:border-neutral-200',
      )}
    >
      <Icon className="size-5 text-neutral-400 shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-900 truncate">
            {doc.category?.name_he ?? doc.file_name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
          <span className="inline-flex items-center gap-1">
            <User2 className="size-3" />
            {borrowerName}
          </span>
          {doc.file_size && (
            <>
              <span className="text-neutral-300">·</span>
              <span>{formatSize(doc.file_size)}</span>
            </>
          )}
          <span className="text-neutral-300">·</span>
          <span className="truncate max-w-[14ch]" title={doc.file_name}>
            {doc.file_name}
          </span>
        </div>
      </div>

      <DocumentStatusChip status={doc.status as DocumentStatus} size="sm" />
    </button>
  );
}
