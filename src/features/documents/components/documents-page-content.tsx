'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { AlertCircle, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { callAction } from '@/lib/actions/call-action';
import type { Locale } from '@/lib/i18n/direction';

import { canonicalDriveFolderRoots, documentsInsideDriveFolder } from '../domain/drive-folder-tree';
import {
  autoSyncDriveDocumentsAction,
  syncDriveDocumentsAction,
} from '../actions/sync-drive-documents';
import type { DocumentChecklistItem } from '../services/document-checklist.service';
import {
  DRIVE_FOLDERS,
  type DocumentCategoryRow,
  type DocumentWithRelations,
  type DriveFolder,
  type DriveFolderNode,
} from '../types';
import { ChecklistManagerModal } from './checklist-manager-modal';
import { DocumentsActionBar } from './documents-action-bar';
import { DocumentPreviewModal } from './document-preview-modal';
import { DriveFolderCard } from './drive-folder-card';
import { FolderCard } from './folder-card';
import { FolderDetail } from './folder-detail';
import { UncategorizedCard } from './uncategorized-card';
import { UploadDocumentModal } from './upload-document-modal';

type Borrower = { id: string; firstName: string | null; lastName: string | null };

/** Grid view when null; otherwise the exact Drive drill-in target. */
type Selection =
  | { kind: 'category'; folder: DriveFolder }
  | { kind: 'custom'; folderId: string }
  | { kind: 'uncategorized' }
  | null;

type Props = {
  caseId: string;
  caseNumber: string;
  borrowerNames: string;
  documents: DocumentWithRelations[];
  categories: DocumentCategoryRow[];
  borrowers: Borrower[];
  driveFolderId: string | null;
  driveFolderTree: DriveFolderNode[];
  hasDriveFolderSnapshot: boolean;
  driveSubfolderIds: Partial<Record<DriveFolder, string>>;
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
  /** Whether the viewer can edit this case (can_edit_case). Gates every write
   *  affordance — upload, sync, request, checklist-manage, recategorize. */
  canEdit: boolean;
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
  driveFolderTree,
  hasDriveFolderSnapshot,
  driveSubfolderIds,
  checklist,
  primaryBorrower,
  locale,
  canEdit,
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
  const autoSyncInFlight = useRef(false);
  const [, startAutoSyncTransition] = useTransition();
  const activePreviewDoc = previewDoc
    ? (documents.find((document) => document.id === previewDoc.id) ?? null)
    : null;

  const runAutomaticSync = useCallback(
    (force: boolean) => {
      if (!canEdit || !driveFolderId || autoSyncInFlight.current) return;
      autoSyncInFlight.current = true;

      startAutoSyncTransition(async () => {
        try {
          const result = force
            ? await callAction(() => syncDriveDocumentsAction(caseId))
            : await callAction(() => autoSyncDriveDocumentsAction(caseId));
          if (
            !result.ok &&
            result.error !== 'unauthorized' &&
            result.error !== 'not_connected' &&
            result.error !== 'rate_limited'
          ) {
            console.warn('[documents] automatic Drive sync failed', { error: result.error });
          }
        } finally {
          autoSyncInFlight.current = false;
        }
      });
    },
    [canEdit, caseId, driveFolderId, startAutoSyncTransition],
  );

  useEffect(() => {
    runAutomaticSync(false);

    // The common workflow is: open Drive in a new tab, delete there, then
    // return to this already-open page. Reconcile on return so no extra click
    // or second navigation is needed.
    const syncOnFocus = () => runAutomaticSync(true);
    const syncOnVisible = () => {
      if (document.visibilityState === 'visible') runAutomaticSync(true);
    };
    window.addEventListener('focus', syncOnFocus);
    document.addEventListener('visibilitychange', syncOnVisible);
    return () => {
      window.removeEventListener('focus', syncOnFocus);
      document.removeEventListener('visibilitychange', syncOnVisible);
    };
  }, [runAutomaticSync]);

  const { buckets, unlocated } = useMemo(() => {
    const result: Record<DriveFolder, DocumentWithRelations[]> = {
      identity: [],
      income_il: [],
      income_abroad: [],
      insurance_collateral: [],
      misc: [],
    };
    const unc: DocumentWithRelations[] = [];
    for (const doc of documents) {
      const f = doc.category?.drive_folder as DriveFolder | undefined;
      if (f && (DRIVE_FOLDERS as readonly string[]).includes(f)) result[f].push(doc);
      else unc.push(doc);
    }
    return { buckets: result, unlocated: unc };
  }, [documents]);

  const canonicalRootByFolder = useMemo(() => {
    const roots = canonicalDriveFolderRoots(driveFolderId, driveFolderTree, driveSubfolderIds);
    const entries: Array<[DriveFolder, DriveFolderNode]> = [];
    for (const folder of DRIVE_FOLDERS) {
      const node = roots[folder];
      if (node) entries.push([folder, node]);
    }
    return new Map(entries);
  }, [driveFolderId, driveFolderTree, driveSubfolderIds]);

  const customRootFolders = useMemo(() => {
    if (!driveFolderId) return [];
    const canonicalIds = new Set([...canonicalRootByFolder.values()].map((folder) => folder.id));
    return driveFolderTree.filter(
      (folder) => folder.parentId === driveFolderId && !canonicalIds.has(folder.id),
    );
  }, [canonicalRootByFolder, driveFolderId, driveFolderTree]);

  const customDocumentsByFolder = useMemo(
    () =>
      new Map(
        customRootFolders.map((folder) => [
          folder.id,
          documentsInsideDriveFolder(unlocated, folder, driveFolderTree),
        ]),
      ),
    [customRootFolders, driveFolderTree, unlocated],
  );

  const uncategorized = useMemo(() => {
    const insideCustomFolder = new Set(
      [...customDocumentsByFolder.values()].flat().map((document) => document.id),
    );
    return unlocated.filter((document) => !insideCustomFolder.has(document.id));
  }, [customDocumentsByFolder, unlocated]);

  // Required-doc checklist grouped by folder, so "what's still missing" lives
  // inside each folder's drill-in rather than a separate sidebar.
  const checklistByFolder = useMemo(() => {
    const byFolder: Record<DriveFolder, DocumentChecklistItem[]> = {
      identity: [],
      income_il: [],
      income_abroad: [],
      insurance_collateral: [],
      misc: [],
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
    <div className="-mt-6 space-y-4">
      <DocumentsActionBar
        caseId={caseId}
        caseNumber={caseNumber}
        borrowerNames={borrowerNames}
        onUpload={handleUploadGlobal}
        driveFolderId={driveFolderId}
        primaryBorrower={primaryBorrower}
        checklist={checklist}
        canEdit={canEdit}
      />

      {selected === null && (
        <>
          {canEdit && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                className="text-brand-gold-text focus-visible:ring-brand-gold-text/40 inline-flex items-center gap-1.5 rounded text-xs hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                {td('manage')}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DRIVE_FOLDERS.filter(
              (folder) =>
                !hasDriveFolderSnapshot ||
                canonicalRootByFolder.has(folder) ||
                buckets[folder].length > 0,
            ).map((folder) => (
              <FolderCard
                key={folder}
                folder={folder}
                title={canonicalRootByFolder.get(folder)?.name}
                documentCount={buckets[folder].length}
                missingCount={missingFor(folder)}
                onOpen={(target) => setSelected({ kind: 'category', folder: target })}
              />
            ))}

            {customRootFolders.map((folder) => (
              <DriveFolderCard
                key={folder.id}
                folder={folder}
                documentCount={customDocumentsByFolder.get(folder.id)?.length ?? 0}
                onOpen={(folderId) => setSelected({ kind: 'custom', folderId })}
              />
            ))}

            {uncategorized.length > 0 && (
              <button
                type="button"
                onClick={() => setSelected({ kind: 'uncategorized' })}
                className="group focus-visible:ring-brand-gold-text/50 w-full rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-start shadow-sm transition hover:border-amber-300 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-amber-100 p-2.5 text-amber-700">
                    <AlertCircle className="size-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-sm leading-tight font-semibold text-neutral-950">
                      {tu('title', { count: uncategorized.length })}
                    </h2>
                    <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{tu('subtitle')}</p>
                  </div>
                  <ChevronLeft
                    aria-hidden="true"
                    className="size-4 shrink-0 text-neutral-400 ltr:rotate-180"
                  />
                </div>
              </button>
            )}
          </div>
        </>
      )}

      {selected?.kind === 'category' &&
        (hasDriveFolderSnapshot &&
        !canonicalRootByFolder.has(selected.folder) &&
        buckets[selected.folder].length === 0 ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="focus-visible:ring-brand-gold-text/40 inline-flex items-center gap-1 rounded text-sm text-neutral-600 hover:text-neutral-900 focus-visible:ring-2 focus-visible:outline-none"
            >
              <ChevronRight className="size-4 ltr:rotate-180" aria-hidden="true" />
              {td('back')}
            </button>
            <p className="rounded-lg border border-neutral-100 bg-white py-10 text-center text-sm text-neutral-500">
              {td('folderUnavailable')}
            </p>
          </div>
        ) : (
          <FolderDetail
            key={`category-${selected.folder}-${canonicalRootByFolder.get(selected.folder)?.id ?? 'local'}`}
            folder={selected.folder}
            rootDriveFolder={canonicalRootByFolder.get(selected.folder) ?? null}
            driveFolderTree={driveFolderTree}
            documents={buckets[selected.folder]}
            checklistItems={checklistByFolder[selected.folder]}
            locale={locale}
            canEdit={canEdit}
            onBack={() => setSelected(null)}
            onUpload={handleUploadFromFolder}
            onPreview={setPreviewDoc}
          />
        ))}

      {selected?.kind === 'custom' &&
        (() => {
          const folder = customRootFolders.find(({ id }) => id === selected.folderId);
          if (!folder) {
            return (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="focus-visible:ring-brand-gold-text/40 inline-flex items-center gap-1 rounded text-sm text-neutral-600 hover:text-neutral-900 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <ChevronRight className="size-4 ltr:rotate-180" aria-hidden="true" />
                  {td('back')}
                </button>
                <p className="rounded-lg border border-neutral-100 bg-white py-10 text-center text-sm text-neutral-500">
                  {td('folderUnavailable')}
                </p>
              </div>
            );
          }
          return (
            <FolderDetail
              key={`custom-${folder.id}`}
              folder={null}
              title={folder.name}
              rootDriveFolder={folder}
              driveFolderTree={driveFolderTree}
              documents={customDocumentsByFolder.get(folder.id) ?? []}
              checklistItems={[]}
              locale={locale}
              canEdit={canEdit}
              onBack={() => setSelected(null)}
              onPreview={setPreviewDoc}
            />
          );
        })()}

      {selected?.kind === 'uncategorized' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="focus-visible:ring-brand-gold-text/40 inline-flex items-center gap-1 rounded text-sm text-neutral-600 hover:text-neutral-900 focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronRight className="size-4 ltr:rotate-180" aria-hidden="true" />
            {td('back')}
          </button>
          <UncategorizedCard
            documents={uncategorized}
            categories={categories}
            caseId={caseId}
            canEdit={canEdit}
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
        key={`preview-${activePreviewDoc?.id ?? 'none'}`}
        doc={activePreviewDoc}
        caseId={caseId}
        canDeleteDocuments={canDeleteDocuments}
        canVerifyDocuments={canVerifyDocuments}
        canSendEmail={canEdit}
        defaultEmailRecipient={primaryBorrower?.email ?? null}
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
