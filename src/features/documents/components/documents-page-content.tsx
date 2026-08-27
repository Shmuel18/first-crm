'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { AlertCircle, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { FORCED_SYNC_RETRY_DELAY_MS } from '@/features/integrations/domain/drive-sync-types';
import { callAction } from '@/lib/actions/call-action';
import type { Locale } from '@/lib/i18n/direction';

import { canonicalDriveFolderRoots, documentsInsideDriveFolder } from '../domain/drive-folder-tree';
import {
  acknowledgeDriveSync,
  decideDriveSyncFollowUp,
  isDriveUrl,
  markDriveOpened,
  pendingDriveSyncVersion,
  requestDriveSyncAfterReturn,
} from '../domain/drive-open-signal';
import { claimDriveSyncRun, releaseDriveSyncRun } from '../domain/drive-sync-run-lock';
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

type DriveSyncTrigger = 'stale' | 'focus' | 'manual' | 'retry';

type ActiveDriveSync = {
  caseId: string;
  trigger: DriveSyncTrigger;
  force: boolean;
  coveredVersion: number | null;
};

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
  /** Whether the viewer can edit this case (can_edit_case). */
  canEdit: boolean;
  /** Upload permission layered on top of case edit authority. Uploads and
   * recategorization require this exact capability. */
  canUploadDocuments: boolean;
  /** Drive reconciliation additionally requires document-view permission. */
  canSyncDrive: boolean;
  canDeleteDocuments: boolean;
  /** AI draft-assist inside this page's compose dialogs (flag + permission). */
  aiDraftEnabled: boolean;
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
  canUploadDocuments,
  canSyncDrive,
  canDeleteDocuments,
  aiDraftEnabled,
}: Props) {
  const t = useTranslations('documents.checklist');
  const td = useTranslations('documents.detail');
  const tSync = useTranslations('documents.sync');
  const tu = useTranslations('documents.uncategorized');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFolder, setUploadFolder] = useState<DriveFolder | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentWithRelations | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [selected, setSelected] = useState<Selection>(null);
  const syncInFlight = useRef<ActiveDriveSync | null>(null);
  const runDriveSyncRef = useRef<((trigger: DriveSyncTrigger) => void) | null>(null);
  const activeCaseIdRef = useRef<string | null>(caseId);
  const forcedRetryTimerRef = useRef<number | null>(null);
  const returnFocusId = useRef<string | null>(null);
  const [syncPending, startSyncTransition] = useTransition();
  const [syncStatus, setSyncStatus] = useState('');
  const activePreviewDoc = previewDoc
    ? (documents.find((document) => document.id === previewDoc.id) ?? null)
    : null;

  // A Server Action promise keeps running after this component unmounts. Mark
  // the owner explicitly so an old completion cannot update this screen,
  // release a newer case's lock, or start follow-up work after navigation.
  useEffect(() => {
    activeCaseIdRef.current = caseId;
    return () => {
      if (activeCaseIdRef.current === caseId) activeCaseIdRef.current = null;
      if (syncInFlight.current?.caseId === caseId) syncInFlight.current = null;
      if (forcedRetryTimerRef.current !== null) {
        clearTimeout(forcedRetryTimerRef.current);
        forcedRetryTimerRef.current = null;
      }
      runDriveSyncRef.current = null;
    };
  }, [caseId]);

  const scheduleForcedRetry = useCallback((scheduledCaseId: string) => {
    if (forcedRetryTimerRef.current !== null) return;
    forcedRetryTimerRef.current = window.setTimeout(() => {
      forcedRetryTimerRef.current = null;
      if (activeCaseIdRef.current === scheduledCaseId) {
        runDriveSyncRef.current?.('retry');
      }
    }, FORCED_SYNC_RETRY_DELAY_MS);
  }, []);

  const runDriveSync = useCallback(
    (trigger: DriveSyncTrigger) => {
      if (activeCaseIdRef.current !== caseId || !canSyncDrive || !driveFolderId) return;

      const force = trigger !== 'stale';
      const coveredVersion = force ? pendingDriveSyncVersion(caseId) : null;
      // Focus/retry runs exist only to service a returned Drive visit. Manual
      // sync remains available without such a signal.
      if ((trigger === 'focus' || trigger === 'retry') && coveredVersion === null) return;
      // A scheduled retry already owns the outstanding debt. Extra focus and
      // visibility events coalesce into that one bounded attempt.
      if (force && forcedRetryTimerRef.current !== null) {
        if (trigger !== 'manual') return;
        // Manual intent is explicit: replace the silent background retry and
        // let the action return its normal rate-limit feedback if still early.
        clearTimeout(forcedRetryTimerRef.current);
        forcedRetryTimerRef.current = null;
      }
      // Returned debt is not consumed here. If a run is active it remains in
      // the versioned registry, and that run's completion will hand it off.
      if (syncInFlight.current !== null) return;

      const claim = claimDriveSyncRun(caseId);
      if (!claim.acquired) {
        // A previous component instance still owns the Server Action. Wait for
        // its real outcome instead of issuing a duplicate after remount.
        if (force) {
          void claim.released.then(({ followUp }) => {
            if (activeCaseIdRef.current !== caseId || pendingDriveSyncVersion(caseId) === null) {
              return;
            }
            if (followUp === 'immediate') runDriveSyncRef.current?.('focus');
            else if (followUp === 'after_cooldown') scheduleForcedRetry(caseId);
          });
        }
        return;
      }

      const run: ActiveDriveSync = { caseId, trigger, force, coveredVersion };
      syncInFlight.current = run;
      setSyncStatus(tSync('syncing'));

      startSyncTransition(async () => {
        let automaticFollowUp = true;
        try {
          const result = force
            ? await callAction(() => syncDriveDocumentsAction(caseId))
            : await callAction(() => autoSyncDriveDocumentsAction(caseId));

          // Success covered the captured visit. Unauthorized/missing cases are
          // terminal for this screen and can be discarded. A disconnected
          // integration or missing Drive folder is reversible, so its debt is
          // preserved for a later focus/remount but not retried in a loop.
          const discardDebt =
            result.ok ||
            (!result.ok && (result.error === 'unauthorized' || result.error === 'case_not_found'));
          automaticFollowUp =
            result.ok ||
            (!result.ok &&
              (result.error === 'rate_limited' ||
                result.error === 'unknown' ||
                result.error === 'network'));
          if (force && coveredVersion !== null && discardDebt) {
            acknowledgeDriveSync(caseId, coveredVersion);
          }

          // A continuation from an unmounted/older case may safely finish on
          // the server, but it must not touch the current UI.
          if (activeCaseIdRef.current !== caseId || syncInFlight.current !== run) return;

          if (result.ok) {
            const parts: string[] = [];
            if ('imported' in result) {
              if (result.imported > 0) parts.push(tSync('imported', { count: result.imported }));
              if (result.updated > 0) parts.push(tSync('updated', { count: result.updated }));
              if (result.deleted > 0) parts.push(tSync('deleted', { count: result.deleted }));
              if (result.pushed > 0) parts.push(tSync('pushed', { count: result.pushed }));
            }
            const message =
              parts.length > 0
                ? parts.join(' · ')
                : trigger === 'manual'
                  ? tSync('nothingNew')
                  : tSync('complete');
            setSyncStatus(message);
            if (trigger === 'manual') {
              if (parts.length > 0) toast.success(message);
              else toast(message);
            }
            return;
          }

          const message =
            result.error === 'no_folder'
              ? tSync('noFolderYet')
              : result.error === 'not_connected'
                ? tSync('errors.notConnected')
                : result.error === 'rate_limited'
                  ? tSync('errors.rateLimited')
                  : tSync('errors.generic');
          setSyncStatus(message);
          if (trigger === 'manual') {
            if (result.error === 'no_folder') toast(message);
            else toast.error(message);
          } else if (
            result.error !== 'unauthorized' &&
            result.error !== 'not_connected' &&
            result.error !== 'rate_limited'
          ) {
            console.warn('[documents] automatic Drive sync failed', { error: result.error });
          }
        } finally {
          const followUp = decideDriveSyncFollowUp({
            automatic: automaticFollowUp,
            force,
            retry: trigger === 'retry',
            coveredVersion,
            pendingVersion: pendingDriveSyncVersion(caseId),
          });
          // Release the per-tab lock even after unmount. A remounted instance
          // may be waiting on this exact Promise to service preserved debt.
          releaseDriveSyncRun(caseId, claim.token, { followUp });

          const ownsCurrentRun = syncInFlight.current === run;
          if (ownsCurrentRun) syncInFlight.current = null;
          if (!ownsCurrentRun || activeCaseIdRef.current !== caseId) return;

          if (followUp === 'immediate') runDriveSyncRef.current?.('focus');
          else if (followUp === 'after_cooldown') scheduleForcedRetry(caseId);
        }
      });
    },
    [canSyncDrive, caseId, driveFolderId, scheduleForcedRetry, startSyncTransition, tSync],
  );

  // Follow-up calls cannot close over runDriveSync directly (self-dependency).
  useEffect(() => {
    runDriveSyncRef.current = runDriveSync;
    return () => {
      if (runDriveSyncRef.current === runDriveSync) runDriveSyncRef.current = null;
    };
  }, [runDriveSync]);

  useEffect(() => {
    // The common workflow is: open Drive in a new tab, delete there, then
    // return to this already-open page. Reconcile on return so no extra click
    // or second navigation is needed — but ONLY when the user actually went to
    // Drive. A forced sync is a serial walk of the case's folders, and firing
    // it on every alt-tab made the screen (and the navigation away from it)
    // pay for a scan nobody asked for. Any other refocus falls back to the
    // cheap staleness check.
    const syncOnReturn = () => {
      const returnedVersion = requestDriveSyncAfterReturn(caseId);
      runDriveSync(returnedVersion === null ? 'stale' : 'focus');
    };
    const syncOnVisible = () => {
      if (document.visibilityState === 'visible') syncOnReturn();
    };
    // Every Drive affordance on this screen is an anchor to drive.google.com;
    // one capture-phase listener catches them all without threading a callback
    // through the card / action-bar / preview-link tree. `auxclick` covers a
    // middle-click and `contextmenu` the "open in new tab" menu — neither
    // fires `click`. Over-marking (menu opened, nothing chosen) costs one
    // forced pass; under-marking loses a real Drive change, so err this way.
    const noteDriveLink = (event: Event) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (anchor instanceof HTMLAnchorElement && isDriveUrl(anchor.href)) {
        markDriveOpened(caseId);
      }
    };

    // On a remount, an unacknowledged visit means the user has returned to
    // this documents screen; otherwise this is just the normal stale check.
    syncOnReturn();
    window.addEventListener('focus', syncOnReturn);
    document.addEventListener('visibilitychange', syncOnVisible);
    for (const type of ['click', 'auxclick', 'contextmenu']) {
      document.addEventListener(type, noteDriveLink, true);
    }
    return () => {
      window.removeEventListener('focus', syncOnReturn);
      document.removeEventListener('visibilitychange', syncOnVisible);
      for (const type of ['click', 'auxclick', 'contextmenu']) {
        document.removeEventListener(type, noteDriveLink, true);
      }
    };
  }, [caseId, runDriveSync]);

  useEffect(() => {
    if (selected !== null || !returnFocusId.current) return;
    document.getElementById(returnFocusId.current)?.focus({ preventScroll: true });
    returnFocusId.current = null;
  }, [selected]);

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

  const returnToFolderGrid = () => setSelected(null);

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
        canUploadDocuments={canUploadDocuments}
        canSyncDrive={canSyncDrive}
        onSync={() => runDriveSync('manual')}
        syncPending={syncPending}
        syncStatus={syncStatus}
        aiDraftEnabled={aiDraftEnabled}
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
                buttonId={`documents-folder-${folder}`}
                folder={folder}
                title={canonicalRootByFolder.get(folder)?.name}
                documentCount={buckets[folder].length}
                missingCount={missingFor(folder)}
                onOpen={(target) => {
                  returnFocusId.current = `documents-folder-${target}`;
                  setSelected({ kind: 'category', folder: target });
                }}
              />
            ))}

            {customRootFolders.map((folder) => (
              <DriveFolderCard
                key={folder.id}
                buttonId={`documents-drive-folder-${folder.id}`}
                folder={folder}
                documentCount={customDocumentsByFolder.get(folder.id)?.length ?? 0}
                onOpen={(folderId) => {
                  returnFocusId.current = `documents-drive-folder-${folderId}`;
                  setSelected({ kind: 'custom', folderId });
                }}
              />
            ))}

            {uncategorized.length > 0 && (
              <button
                id="documents-folder-uncategorized"
                type="button"
                onClick={() => {
                  returnFocusId.current = 'documents-folder-uncategorized';
                  setSelected({ kind: 'uncategorized' });
                }}
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
              onClick={returnToFolderGrid}
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
            caseId={caseId}
            checklistItems={checklistByFolder[selected.folder]}
            locale={locale}
            canUploadDocuments={canUploadDocuments}
            onBack={returnToFolderGrid}
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
                  onClick={returnToFolderGrid}
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
              caseId={caseId}
              checklistItems={[]}
              locale={locale}
              canUploadDocuments={canUploadDocuments}
              onBack={returnToFolderGrid}
              onPreview={setPreviewDoc}
            />
          );
        })()}

      {selected?.kind === 'uncategorized' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={returnToFolderGrid}
            className="focus-visible:ring-brand-gold-text/40 inline-flex items-center gap-1 rounded text-sm text-neutral-600 hover:text-neutral-900 focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronRight className="size-4 ltr:rotate-180" aria-hidden="true" />
            {td('back')}
          </button>
          <UncategorizedCard
            documents={uncategorized}
            categories={categories}
            caseId={caseId}
            canEdit={canUploadDocuments}
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
        key={`preview-${activePreviewDoc?.id ?? 'none'}-${activePreviewDoc?.updated_at ?? 'none'}`}
        doc={activePreviewDoc}
        caseId={caseId}
        canDeleteDocuments={canDeleteDocuments}
        canSendEmail={canEdit}
        defaultEmailRecipient={primaryBorrower?.email ?? null}
        aiDraftEnabled={aiDraftEnabled}
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
