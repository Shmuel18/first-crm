import { notFound } from 'next/navigation';

import { getLocale } from 'next-intl/server';

import { listBorrowersForCase } from '@/features/borrowers/services/borrowers.service';
import { DocumentsPageContent } from '@/features/documents/components/documents-page-content';
import { getCaseDocumentChecklist } from '@/features/documents/services/document-checklist.service';
import {
  listDocumentCategories,
  listDocumentsForCase,
} from '@/features/documents/services/documents.service';
import { getCaseById } from '@/features/cases/services/cases.service';
import { autoSyncIfStale } from '@/features/integrations/services/drive-document-sync';
import { parseLocale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';
import { formatPersonName } from '@/lib/utils/person-name';

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

  const [caseData, documents, categories, borrowers, locale] = await Promise.all([
    getCaseById(caseId),
    listDocumentsForCase(caseId),
    listDocumentCategories(),
    listBorrowersForCase(caseId),
    getLocale().then(parseLocale),
  ]);

  if (!caseData) notFound();

  // Per-case requirements checklist (joins case_type_documents + the
  // already-loaded documents to compute missing/pending/verified status).
  // Returns [] when the case has no primary type — the component hides
  // itself in that case so the page reads identically.
  const checklist = await getCaseDocumentChecklist(
    caseId,
    caseData.case_type_primary?.id ?? null,
    documents,
  );

  const borrowerNames =
    borrowers
      .map(({ borrower }) => formatPersonName(borrower.first_name, borrower.last_name))
      .filter(Boolean)
      .join(' & ') || '';

  const borrowerOptions = borrowers.map(({ borrower }) => ({
    id: borrower.id,
    firstName: borrower.first_name,
    lastName: borrower.last_name,
  }));

  // Forwarded to the action bar so the "request docs" menu can build the
  // wa.me link and gate the email option. Prefer the explicit primary link;
  // fall back to the first borrower if old/imported data has no primary flag.
  const primaryRecord = borrowers.find((row) => row.is_primary) ?? borrowers[0];
  const primaryBorrower = primaryRecord
    ? {
        firstName: primaryRecord.borrower.first_name,
        lastName: primaryRecord.borrower.last_name,
        email: primaryRecord.borrower.email,
        phone: primaryRecord.borrower.phone,
      }
    : null;

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
      checklist={checklist}
      primaryBorrower={primaryBorrower}
      locale={locale}
    />
  );
}
