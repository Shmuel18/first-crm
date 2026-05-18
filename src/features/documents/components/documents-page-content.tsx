'use client';

import { useMemo, useState } from 'react';

import { DRIVE_FOLDERS, type DocumentWithRelations, type DocumentCategoryRow, type DriveFolder } from '../types';
import { DocumentsActionBar } from './documents-action-bar';
import { DocumentsSummary } from './documents-summary';
import { DocumentPreviewModal } from './document-preview-modal';
import { FolderCard } from './folder-card';
import { UploadDocumentModal } from './upload-document-modal';

type Borrower = { id: string; firstName: string | null; lastName: string | null };

type Props = {
  caseId: string;
  caseNumber: string;
  borrowerNames: string;
  documents: DocumentWithRelations[];
  categories: DocumentCategoryRow[];
  borrowers: Borrower[];
};

export function DocumentsPageContent({
  caseId,
  caseNumber,
  borrowerNames,
  documents,
  categories,
  borrowers,
}: Props) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFolder, setUploadFolder] = useState<DriveFolder | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentWithRelations | null>(null);

  const buckets = useMemo(() => {
    const result: Record<DriveFolder, DocumentWithRelations[]> = {
      identity: [],
      income_il: [],
      income_abroad: [],
      insurance_collateral: [],
    };
    for (const doc of documents) {
      const f = doc.category?.drive_folder as DriveFolder | undefined;
      if (f && (DRIVE_FOLDERS as readonly string[]).includes(f)) {
        result[f].push(doc);
      }
    }
    return result;
  }, [documents]);

  const totals = useMemo(() => {
    const total = documents.length;
    const verified = documents.filter((d) => d.status === 'verified').length;
    const pending = documents.filter((d) => d.status === 'new').length;
    return { total, verified, pending };
  }, [documents]);

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
      />

      <DocumentsSummary {...totals} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      <UploadDocumentModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        caseId={caseId}
        categories={categories}
        borrowers={borrowers}
        defaultFolder={uploadFolder}
      />

      <DocumentPreviewModal
        doc={previewDoc}
        caseId={caseId}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}
