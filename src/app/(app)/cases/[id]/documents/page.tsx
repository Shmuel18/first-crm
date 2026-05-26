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

  // Fire-and-forget the Drive freshness check. Previously this was awaited
  // before any rendering, which blocked first paint on a Google API hop
  // (~600 ms p99, up to 10 s on a cold/throttled call). The page now
  // renders from the DB immediately; the next visit picks up whatever the
  // sync wrote. autoSyncIfStale has internal 10 s throttling so rapid
  // navigation doesn't spam Drive.
  void autoSyncIfStale(caseId).catch((err) => {
    console.warn('[documents page] background sync failed', {
      caseId,
      message: err instanceof Error ? err.message : 'unknown',
    });
  });

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
