'use client';

import { useMemo, useState } from 'react';

import { AlertCircle, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { Locale } from '@/lib/i18n/direction';

import type { DocumentChecklistItem } from '../services/document-checklist.service';
import {
  DRIVE_FOLDERS,
  type DocumentCategoryRow,
  type DocumentWithRelations,
  type DriveFolder,
} from '../types';
import { ChecklistManagerModal } from './checklist-manager-modal';
import { DocumentsActionBar } from './documents-action-bar';
import { DocumentPreviewModal } from './document-preview-modal';
import { FolderCard } from './folder-card';
import { FolderDetail } from './folder-detail';
import { UncategorizedCard } from './uncategorized-card';
import { UploadDocumentModal } from './upload-document-modal';

type Borrower = { id: string; firstName: string | null; lastName: string | null };

/** Grid view when null; otherwise the drill-in target. */
type Selection = DriveFolder | 'uncategorized' | null;

type Props = {
  caseId: string;
  caseNumber: string;
  borrowerNames: string;
  documents: DocumentWithRelations[];
  categories: DocumentCategoryRow[];
  borrowers: Borrower[];
  driveFolderId: string | null;
  /** Required-docs checklist for the case's primary type — [] when no
   *  type is set or no requirements seeded. */
  checklist: ReadonlyArray<DocumentChecklistItem>;
  /** Primary borrower's contact info — forwarded to the action bar's
   *  "request docs" menu so it can offer Email + WhatsApp channels. */
  primaryBorrower: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  locale: Locale;
  canDeleteDocuments: boolean;
  canVerifyDocuments: boolean;
};

export function DocumentsPageContent({
  caseId,
  caseNumber,
  borrowerNames,
  documents,
  categories,
  borrowers,
  driveFolderId,
  checklist,
  primaryBorrower,
  locale,
  canDeleteDocuments,
  canVerifyDocuments,
}: Props) {
  const t = useTranslations('documents.checklist');
  const td = useTranslations('documents.detail');
  const tu = useTranslations('documents.uncategorized');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFolder, setUploadFolder] = useState<DriveFolder | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentWithRelations | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [selected, setSelected] = useState<Selection>(null);

  const { buckets, uncategorized } = useMemo(() => {
    const result: Record<DriveFolder, DocumentWithRelations[]> = {
      identity: [],
      income_il: [],
      income_abroad: [],
      insurance_collateral: [],
    };
    const unc: DocumentWithRelations[] = [];
    for (const doc of documents) {
      const f = doc.category?.drive_folder as DriveFolder | undefined;
      if (f && (DRIVE_FOLDERS as readonly string[]).includes(f)) result[f].push(doc);
      else unc.push(doc);
    }
    return { buckets: result, uncategorized: unc };
  }, [documents]);

  // Required-doc checklist grouped by folder, so "what's still missing" lives
  // inside each folder's drill-in rather than a separate sidebar.
  const checklistByFolder = useMemo(() => {
    const byFolder: Record<DriveFolder, DocumentChecklistItem[]> = {
      identity: [],
      income_il: [],
      income_abroad: [],
      insurance_collateral: [],
    };
    for (const item of checklist) {
      const f = item.driveFolder;
      if (f && (DRIVE_FOLDERS as readonly string[]).includes(f)) byFolder[f].push(item);
    }
    return byFolder;
  }, [checklist]);

  const handleUploadFromFolder = (folder: DriveFolder) => {
    setUploadFolder(folder);
    setUploadOpen(true);
  };

  const handleUploadGlobal = () => {
    setUploadFolder(null);
    setUploadOpen(true);
  };

  const missingFor = (folder: DriveFolder): number =>
    checklistByFolder[folder].filter((i) => i.status === 'missing').length;

  return (
    <div className="space-y-4 -mt-6">
      <DocumentsActionBar
        caseId={caseId}
        caseNumber={caseNumber}
        borrowerNames={borrowerNames}
        onUpload={handleUploadGlobal}
        driveFolderId={driveFolderId}
        primaryBorrower={primaryBorrower}
        checklist={checklist}
      />

      {selected === null && (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setManageOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs text-brand-gold-text hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              {td('manage')}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {DRIVE_FOLDERS.map((folder) => (
              <FolderCard
                key={folder}
                folder={folder}
                documentCount={buckets[folder].length}
                missingCount={missingFor(folder)}
                onOpen={setSelected}
              />
            ))}

            {uncategorized.length > 0 && (
              <button
                type="button"
                onClick={() => setSelected('uncategorized')}
                className="group w-full text-start rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm transition hover:border-amber-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-amber-100 text-amber-700">
                    <AlertCircle className="size-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display text-sm font-semibold text-neutral-950 leading-tight">
                      {tu('title', { count: uncategorized.length })}
                    </h2>
                    <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{tu('subtitle')}</p>
                  </div>
                  <ChevronLeft
                    aria-hidden="true"
                    className="size-4 text-neutral-400 shrink-0 ltr:rotate-180"
                  />
                </div>
              </button>
            )}
          </div>
        </>
      )}

      {selected !== null && selected !== 'uncategorized' && (
        <FolderDetail
          folder={selected}
          documents={buckets[selected]}
          checklistItems={checklistByFolder[selected]}
          locale={locale}
          onBack={() => setSelected(null)}
          onUpload={handleUploadFromFolder}
          onPreview={setPreviewDoc}
        />
      )}

      {selected === 'uncategorized' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
          >
            <ChevronRight className="size-4 ltr:rotate-180" aria-hidden="true" />
            {td('back')}
          </button>
          <UncategorizedCard
            documents={uncategorized}
            categories={categories}
            caseId={caseId}
            onPreview={setPreviewDoc}
          />
        </div>
      )}

      {/* `key` forces a fresh mount on open/close so child state (fileName,
          useActionState result, refs) resets without per-effect setState. */}
      <UploadDocumentModal
        key={`upload-${String(uploadOpen)}`}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        caseId={caseId}
        categories={categories}
        borrowers={borrowers}
        defaultFolder={uploadFolder}
      />

      {/* Same idea: switching docs (or closing) gives the modal a fresh
          mount so the URL fetch starts clean. */}
      <DocumentPreviewModal
        key={`preview-${previewDoc?.id ?? 'none'}`}
        doc={previewDoc}
        caseId={caseId}
        canDeleteDocuments={canDeleteDocuments}
        canVerifyDocuments={canVerifyDocuments}
        onClose={() => setPreviewDoc(null)}
      />

      <ChecklistManagerModal
        open={manageOpen}
        onOpenChange={setManageOpen}
        caseId={caseId}
        title={borrowerNames ? `${t('manage.title')} — ${borrowerNames}` : t('manage.title')}
        items={checklist}
        locale={locale}
      />
    </div>
  );
}
