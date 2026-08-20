'use client';

import { FileText, Image as ImageIcon, FileType2, User2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { formatPersonName } from '@/lib/utils/person-name';

import type { DocumentStatus, DocumentWithRelations } from '../types';
import { DocumentStatusChip } from './document-status-chip';

type Props = {
  doc: DocumentWithRelations;
  onClick: (doc: DocumentWithRelations) => void;
};

// Declared at module scope (not inside the component) so the React runtime
// sees a stable component type. Returning the Icon variable from a helper
// then rendering <Icon /> triggers react-hooks/static-components.
function FileTypeIcon({ mime, className }: { mime: string | null; className?: string }) {
  if (!mime) return <FileType2 className={className} />;
  if (mime.startsWith('image/')) return <ImageIcon className={className} />;
  if (mime === 'application/pdf') return <FileText className={className} />;
  return <FileType2 className={className} />;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentRow({ doc, onClick }: Props) {
  const tc = useTranslations('documents.card');
  const borrowerName = doc.borrower
    ? formatPersonName(doc.borrower.first_name, doc.borrower.last_name)
    : tc('borrowerGeneral');

  return (
    <button
      type="button"
      onClick={() => onClick(doc)}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-start',
        'hover:bg-neutral-50 active:bg-neutral-100 transition-colors',
        'border border-transparent hover:border-neutral-200',
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-neutral-100">
        <FileTypeIcon mime={doc.mime_type} className="size-4 text-neutral-500" />
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-neutral-950 truncate">
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
