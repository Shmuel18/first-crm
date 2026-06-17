'use client';

import { ChevronRight, FileWarning, Plus, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { Locale } from '@/lib/i18n/direction';

import { useDocumentPreviews } from '../hooks/use-document-previews';
import type { DocumentChecklistItem } from '../services/document-checklist.service';
import type { DocumentWithRelations, DriveFolder } from '../types';
import { DocumentCard } from './document-card';
import { FOLDER_ICON, FOLDER_ICON_TINT } from './folder-card';

type Props = {
  folder: DriveFolder;
  documents: DocumentWithRelations[];
  /** Checklist items belonging to this folder (already filtered by caller). */
  checklistItems: ReadonlyArray<DocumentChecklistItem>;
  locale: Locale;
  /** Gate the upload affordances for view-only users (C-036). */
  canEdit: boolean;
  onBack: () => void;
  onUpload: (folder: DriveFolder) => void;
  onPreview: (doc: DocumentWithRelations) => void;
};

/**
 * Drill-in view for one folder (Drive-style): a back breadcrumb, the
 * still-required items for this category (so the "what's missing" tracking
 * lives inside the folder), and the uploaded files. Reached by clicking a
 * FolderCard; the grid is hidden while this is open.
 */
export function FolderDetail({
  folder,
  documents,
  checklistItems,
  locale,
  canEdit,
  onBack,
  onUpload,
  onPreview,
}: Props) {
  const t = useTranslations('documents.folders');
  const td = useTranslations('documents.detail');
  const tc = useTranslations('documents.card');

  const Icon = FOLDER_ICON[folder];
  const missing = checklistItems.filter((i) => i.status === 'missing');
  // Inline thumbnails for this folder's files — fetched once the folder opens.
  const previews = useDocumentPreviews(documents);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <header className="flex items-center gap-2.5 border-b border-neutral-100 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
        >
          <ChevronRight className="size-4 ltr:rotate-180" aria-hidden="true" />
          {td('back')}
        </button>
        <span className="text-neutral-300" aria-hidden="true">
          /
        </span>
        <span className={`p-1.5 rounded-md ${FOLDER_ICON_TINT[folder]}`}>
          <Icon className="size-4" />
        </span>
        <h2 className="flex-1 min-w-0 font-display text-sm font-semibold text-neutral-950 truncate">
          {t(`${folder}.title`)}
        </h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => onUpload(folder)}
            className="btn-gold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {tc('addDocument')}
          </button>
        )}
      </header>

      <div className="p-4 space-y-5">
        {/* Files first: entering a folder shows its documents immediately as a
            Drive-style thumbnail grid. */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
            {td('uploadedTitle')}
          </h3>
          {documents.length === 0 ? (
            <p className="rounded-lg border border-neutral-100 py-10 text-center text-sm text-neutral-500">
              {td('noFiles')}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  previewUrl={previews.get(doc.id) ?? null}
                  onClick={onPreview}
                />
              ))}
            </div>
          )}
        </div>

        {missing.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
              {td('requiredTitle')}
            </h3>
            <ul className="space-y-1.5">
              {missing.map((item) => (
                <li
                  key={item.itemId}
                  className="flex items-center gap-3 rounded-md border border-rose-100 bg-rose-50/40 px-3 py-2"
                >
                  <FileWarning className="size-4 text-rose-500 shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-0 text-sm text-neutral-900 truncate">
                    {locale === 'he' ? item.nameHe : item.nameEn}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onUpload(folder)}
                      className="shrink-0 inline-flex items-center gap-1 text-xs text-brand-gold-text hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
                    >
                      <Upload className="size-3.5" aria-hidden="true" />
                      {tc('addDocument')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
