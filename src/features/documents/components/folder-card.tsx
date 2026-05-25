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
  identity: 'from-sky-50 to-white border-sky-100',
  income_il: 'from-emerald-50 to-white border-emerald-100',
  income_abroad: 'from-violet-50 to-white border-violet-100',
  insurance_collateral: 'from-amber-50 to-white border-amber-100',
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

  return (
    <section
      className={`relative rounded-2xl border bg-gradient-to-b p-5 shadow-sm ${FOLDER_ACCENT[folder]}`}
    >
      <header className="flex items-start gap-3 mb-4">
        <div className={`p-2.5 rounded-xl ${FOLDER_ICON_TINT[folder]}`}>
          <Icon className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-base font-semibold text-neutral-900 leading-tight">
            {t(`${folder}.title`)}
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">{t(`${folder}.subtitle`)}</p>
        </div>
        <button
          type="button"
          onClick={() => onUpload(folder)}
          aria-label={tc('addDocument')}
          className="size-9 inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:text-brand-gold-text hover:border-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50 transition shrink-0"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </header>

      {documents.length > 0 && (
        <div className="text-[11px] text-neutral-700 mb-2 px-1 inline-flex items-center gap-2">
          <FileText className="size-3" aria-hidden="true" />
          {tc('documentCount', { count: documents.length })}
          {verifiedCount > 0 && (
            <>
              <span aria-hidden="true" className="text-neutral-400">·</span>
              <span className="inline-flex items-center gap-1 text-emerald-800">
                <CheckCircle2 className="size-3" aria-hidden="true" />
                {verifiedCount}
              </span>
            </>
          )}
        </div>
      )}

      <div className="space-y-1">
        {documents.length === 0 ? (
          <p className="text-sm text-neutral-600 text-center py-6 italic">
            {tc('noDocuments')}
          </p>
        ) : (
          documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} onClick={onPreview} />
          ))
        )}
      </div>
    </section>
  );
}
