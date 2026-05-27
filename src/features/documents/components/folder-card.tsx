'use client';

import { useMemo } from 'react';

import {
  Briefcase,
  CheckCircle2,
  FileText,
  Globe2,
  Plus,
  ShieldCheck,
  UserSquare2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { DocumentWithRelations, DriveFolder } from '../types';
import { DocumentRow } from './document-row';
import { DocumentStatusChip } from './document-status-chip';

type Props = {
  folder: DriveFolder;
  documents: DocumentWithRelations[];
  onUpload: (folder: DriveFolder) => void;
  onPreview: (doc: DocumentWithRelations) => void;
};

const FOLDER_ICON: Record<DriveFolder, React.ComponentType<{ className?: string }>> = {
  identity: UserSquare2,
  income_il: Briefcase,
  income_abroad: Globe2,
  insurance_collateral: ShieldCheck,
};

const FOLDER_ACCENT: Record<DriveFolder, string> = {
  identity: 'border-sky-100 bg-sky-50/30',
  income_il: 'border-emerald-100 bg-emerald-50/30',
  income_abroad: 'border-violet-100 bg-violet-50/30',
  insurance_collateral: 'border-amber-100 bg-amber-50/30',
};

const FOLDER_ICON_TINT: Record<DriveFolder, string> = {
  identity: 'text-sky-700 bg-sky-100',
  income_il: 'text-emerald-700 bg-emerald-100',
  income_abroad: 'text-violet-700 bg-violet-100',
  insurance_collateral: 'text-amber-800 bg-amber-100',
};

export function FolderCard({ folder, documents, onUpload, onPreview }: Props) {
  const t = useTranslations('documents.folders');
  const tc = useTranslations('documents.card');

  const Icon = FOLDER_ICON[folder];
  const verifiedCount = useMemo(
    () => documents.filter((d) => d.status === 'verified').length,
    [documents],
  );
  const pendingCount = useMemo(
    () => documents.filter((d) => d.status === 'new').length,
    [documents],
  );

  return (
    <section
      className={`relative overflow-hidden rounded-lg border bg-white shadow-sm ${FOLDER_ACCENT[folder]}`}
    >
      <header className="flex items-center gap-3 border-b border-neutral-100 bg-white/85 px-4 py-3">
        <div className={`p-2 rounded-md ${FOLDER_ICON_TINT[folder]}`}>
          <Icon className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-sm font-semibold text-neutral-950 leading-tight">
            {t(`${folder}.title`)}
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5 truncate">
            {t(`${folder}.subtitle`)}
          </p>
        </div>
        {pendingCount > 0 && <DocumentStatusChip status="new" size="sm" />}
        <button
          type="button"
          onClick={() => onUpload(folder)}
          aria-label={tc('addDocument')}
          className="size-9 inline-flex items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 hover:text-brand-gold-text hover:border-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50 transition shrink-0"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </header>

      <div className="px-4 py-3">
        <div className="mb-3 flex items-center justify-between gap-3 text-[11px] text-neutral-600">
          <span className="inline-flex items-center gap-1.5">
            <FileText className="size-3" aria-hidden="true" />
            {tc('documentCount', { count: documents.length })}
          </span>
          <span className="inline-flex items-center gap-1.5 text-emerald-700">
            <CheckCircle2 className="size-3" aria-hidden="true" />
            {verifiedCount}
          </span>
        </div>

        <div className="space-y-1 rounded-lg border border-neutral-100 bg-white p-1">
          {documents.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-8">
              {tc('noDocuments')}
            </p>
          ) : (
            documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} onClick={onPreview} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}
