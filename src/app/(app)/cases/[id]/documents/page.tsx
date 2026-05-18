import { notFound } from 'next/navigation';

import { listBorrowersForCase } from '@/features/borrowers/services/borrowers.service';
import { DocumentsPageContent } from '@/features/documents/components/documents-page-content';
import {
  listDocumentCategories,
  listDocumentsForCase,
} from '@/features/documents/services/documents.service';
import { getCaseById } from '@/features/cases/services/cases.service';
import { autoSyncIfStale } from '@/features/integrations/services/drive-document-sync';
import { asCaseId } from '@/lib/types/branded';

type Props = { params: Promise<{ id: string }> };

export default async function CaseDocumentsPage({ params }: Props) {
  const { id } = await params;
  const caseId = asCaseId(id);

  // Best-effort: pull fresh files from Drive before rendering.
  // Rate-limited internally to once every 10s - cheap if user navigates fast.
  await autoSyncIfStale(caseId);

  const [caseData, documents, categories, borrowers] = await Promise.all([
    getCaseById(caseId),
    listDocumentsForCase(caseId),
    listDocumentCategories(),
    listBorrowersForCase(caseId),
  ]);

  if (!caseData) notFound();

  const borrowerNames =
    borrowers
      .map(({ borrower }) =>
        [borrower.first_name, borrower.last_name].filter(Boolean).join(' '),
      )
      .filter(Boolean)
      .join(' & ') || '';

  const borrowerOptions = borrowers.map(({ borrower }) => ({
    id: borrower.id,
    firstName: borrower.first_name,
    lastName: borrower.last_name,
  }));

  const driveFolderId =
    caseData.metadata &&
    typeof caseData.metadata === 'object' &&
    'drive' in caseData.metadata
      ? ((caseData.metadata as { drive?: { case_folder_id?: string } }).drive?.case_folder_id ?? null)
      : null;

  return (
    <DocumentsPageContent
      caseId={caseData.id}
      caseNumber={caseData.case_number}
      borrowerNames={borrowerNames}
      documents={documents}
      categories={categories}
      borrowers={borrowerOptions}
      driveFolderId={driveFolderId}
    />
  );
}
