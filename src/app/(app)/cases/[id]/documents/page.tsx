import { notFound } from 'next/navigation';

import { getLocale } from 'next-intl/server';

import { listBorrowersForCase } from '@/features/borrowers/services/borrowers.service';
import { DocumentsPageContent } from '@/features/documents/components/documents-page-content';
import {
  hasCaseDriveFolderSnapshot,
  readCaseDriveFolderTree,
  readCaseDriveSubfolderIds,
} from '@/features/documents/domain/drive-folder-tree';
import { getCaseDocumentChecklist } from '@/features/documents/services/document-checklist.service';
import {
  listDocumentCategories,
  listDocumentsForCase,
} from '@/features/documents/services/documents.service';
import { getCaseById } from '@/features/cases/services/cases.service';
import { provisionCaseDriveFolders } from '@/features/integrations/services/drive-case-uploader';
import { userCanEditCase, userHasPermissions } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';
import { formatPersonName } from '@/lib/utils/person-name';

type Props = { params: Promise<{ id: string }> };

export default async function CaseDocumentsPage({ params }: Props) {
  const { id } = await params;
  const caseId = asCaseId(id);

  // Can this viewer edit the case? Gates every write affordance below (C-036)
  // and the Drive sync (which WRITES document rows — pointless + RLS-denied for
  // a view-only viewer, R11 DRIVE-3).
  const canEdit = await userCanEditCase(caseId);

  const [caseData, documents, categories, borrowers, locale, documentPermissions] =
    await Promise.all([
      getCaseById(caseId),
      listDocumentsForCase(caseId),
      listDocumentCategories(),
      listBorrowersForCase(caseId),
      getLocale().then(parseLocale),
      userHasPermissions('delete_document', 'upload_document', 'view_case_documents'),
    ]);

  if (!caseData) notFound();

  // Per-case requirements checklist. Materialized in case_checklist_items
  // (seeded from the case-type template on first access, migration 099);
  // folds in the already-loaded documents to derive each row's status.
  const checklist = await getCaseDocumentChecklist(caseId, documents);

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

  let driveMetadata = caseData.metadata;
  let driveFolderId = readCaseDriveFolderId(driveMetadata);

  // First time a case's documents are opened without a Drive folder yet,
  // finish provisioning before rendering and reload the persisted snapshot.
  // This one-time wait means "open in Drive" and sync work on the first visit,
  // instead of presenting disabled controls that require a manual refresh.
  if (!driveFolderId && canEdit && documentPermissions.upload_document === true) {
    await provisionCaseDriveFolders({ caseId: caseData.id, admin: true });
    const provisionedCase = await getCaseById(caseId);
    if (provisionedCase) {
      driveMetadata = provisionedCase.metadata;
      driveFolderId = readCaseDriveFolderId(driveMetadata);
    }
  }

  const driveFolderTree = readCaseDriveFolderTree(driveMetadata);
  const hasDriveFolderSnapshot = hasCaseDriveFolderSnapshot(driveMetadata);
  const driveSubfolderIds = readCaseDriveSubfolderIds(driveMetadata);

  return (
    <DocumentsPageContent
      caseId={caseData.id}
      caseNumber={caseData.case_number}
      borrowerNames={borrowerNames}
      documents={documents}
      categories={categories}
      borrowers={borrowerOptions}
      driveFolderId={driveFolderId}
      driveFolderTree={driveFolderTree}
      hasDriveFolderSnapshot={hasDriveFolderSnapshot}
      driveSubfolderIds={driveSubfolderIds}
      checklist={checklist}
      primaryBorrower={primaryBorrower}
      locale={locale}
      canEdit={canEdit}
      canUploadDocuments={documentPermissions.upload_document === true && canEdit}
      canSyncDrive={
        documentPermissions.upload_document === true &&
        documentPermissions.view_case_documents === true &&
        canEdit
      }
      canDeleteDocuments={documentPermissions.delete_document === true && canEdit}
    />
  );
}

function readCaseDriveFolderId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || !('drive' in metadata)) return null;
  const id = (metadata as { drive?: { case_folder_id?: unknown } }).drive?.case_folder_id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}
