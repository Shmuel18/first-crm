'use client';

import { useMemo, useState } from 'react';

import { useTranslations } from 'next-intl';

import type { Locale } from '@/lib/i18n/direction';

import type { DocumentChecklistItem } from '../services/document-checklist.service';
import { DRIVE_FOLDERS, type DocumentWithRelations, type DocumentCategoryRow, type DriveFolder } from '../types';
import { ChecklistManagerModal } from './checklist-manager-modal';
import { DocumentsActionBar } from './documents-action-bar';
import { DocumentsChecklist } from './documents-checklist';
import { DocumentsSummary } from './documents-summary';
import { DocumentPreviewModal } from './document-preview-modal';
import { FolderCard } from './folder-card';
import { UncategorizedCard } from './uncategorized-card';
import { UploadDocumentModal } from './upload-document-modal';

type Borrower = { id: string; firstName: string | null; lastName: string | null };

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
}: Props) {
  const t = useTranslations('documents.checklist');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFolder, setUploadFolder] = useState<DriveFolder | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentWithRelations | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

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
      if (f && (DRIVE_FOLDERS as readonly string[]).includes(f)) {
        result[f].push(doc);
      } else {
        unc.push(doc);
      }
    }
    return { buckets: result, uncategorized: unc };
  }, [documents]);

  const totals = useMemo(() => {
    const total = documents.length;
    const verified = documents.filter((d) => d.status === 'verified').length;
    const pending = documents.filter((d) => d.status === 'new').length;
    const requiredItems = checklist.filter((item) => item.isRequired);
    const missing = requiredItems.filter((item) => item.status === 'missing').length;
    const collected = requiredItems.length - missing;
    return {
      total,
      verified,
      pending,
      missing,
      requiredTotal: requiredItems.length,
      collected,
    };
  }, [checklist, documents]);

  const handleUploadFromFolder = (folder: DriveFolder) => {
    setUploadFolder(folder);
    setUploadOpen(true);
  };

  const handleUploadGlobal = () => {
    setUploadFolder(null);
    setUploadOpen(true);
  };

  return (
    <div className="space-y-5 -mt-6">
      <DocumentsActionBar
        caseId={caseId}
        caseNumber={caseNumber}
        borrowerNames={borrowerNames}
        onUpload={handleUploadGlobal}
        driveFolderId={driveFolderId}
        primaryBorrower={primaryBorrower}
        checklist={checklist}
      />

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <DocumentsSummary {...totals} />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4 items-start">
        <div className="xl:sticky xl:top-24">
          <DocumentsChecklist
            items={checklist}
            locale={locale}
            onUploadToFolder={handleUploadFromFolder}
            onManage={() => setManageOpen(true)}
          />
        </div>

        <div className="space-y-4">
          {uncategorized.length > 0 && (
            <UncategorizedCard
              documents={uncategorized}
              categories={categories}
              caseId={caseId}
              onPreview={setPreviewDoc}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {DRIVE_FOLDERS.map((folder) => (
              <FolderCard
                key={folder}
                folder={folder}
                documents={buckets[folder]}
                onUpload={handleUploadFromFolder}
                onPreview={setPreviewDoc}
              />
            ))}
          </div>
        </div>
      </div>

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
