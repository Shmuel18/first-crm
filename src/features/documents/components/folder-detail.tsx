'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FileWarning,
  Folder,
  Plus,
  Upload,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { Locale } from '@/lib/i18n/direction';

import { useDocumentPreviews } from '../hooks/use-document-previews';
import { driveFolderBreadcrumb } from '../domain/drive-folder-breadcrumb';
import {
  descendantFolderIds,
  documentsDirectlyInDriveFolder,
  documentsInsideDriveFolder,
} from '../domain/drive-folder-tree';
import type { DocumentChecklistItem } from '../services/document-checklist.service';
import type { DocumentWithRelations, DriveFolder, DriveFolderNode } from '../types';
import { DocumentCard } from './document-card';
import { FOLDER_ICON, FOLDER_ICON_TINT } from './folder-card';

type Props = {
  /** Null for a custom top-level Drive folder outside the five categories. */
  folder: DriveFolder | null;
  title?: string;
  rootDriveFolder: DriveFolderNode | null;
  driveFolderTree: ReadonlyArray<DriveFolderNode>;
  documents: DocumentWithRelations[];
  /** Checklist items belonging to this folder (already filtered by caller). */
  checklistItems: ReadonlyArray<DocumentChecklistItem>;
  locale: Locale;
  /** Exact capability required by every upload affordance. */
  canUploadDocuments: boolean;
  onBack: () => void;
  onUpload?: (folder: DriveFolder) => void;
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
  title,
  rootDriveFolder,
  driveFolderTree,
  documents,
  checklistItems,
  locale,
  canUploadDocuments,
  onBack,
  onUpload,
  onPreview,
}: Props) {
  const t = useTranslations('documents.folders');
  const td = useTranslations('documents.detail');
  const tc = useTranslations('documents.card');

  const rootTitle = rootDriveFolder?.name ?? (folder ? t(`${folder}.title`) : (title ?? ''));
  const fallbackRoot = useMemo<DriveFolderNode>(
    () => ({
      id: `local:${folder ?? title ?? 'folder'}`,
      parentId: '',
      name: rootTitle,
      relativePath: [],
    }),
    [folder, rootTitle, title],
  );
  const root = rootDriveFolder ?? fallbackRoot;
  const [currentFolderId, setCurrentFolderId] = useState(root.id);
  const subtreeFolderIds = useMemo(
    () => descendantFolderIds(root.id, driveFolderTree),
    [driveFolderTree, root.id],
  );
  const folderById = useMemo(
    () =>
      new Map(
        [root, ...driveFolderTree.filter((node) => subtreeFolderIds.has(node.id))].map((node) => [
          node.id,
          node,
        ]),
      ),
    [driveFolderTree, root, subtreeFolderIds],
  );
  const currentFolder = folderById.get(currentFolderId) ?? root;
  const atRoot = currentFolder.id === root.id;
  const breadcrumb = useMemo(
    () => driveFolderBreadcrumb(root, currentFolder.id, driveFolderTree),
    [currentFolder.id, driveFolderTree, root],
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const currentCrumbRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    currentCrumbRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [currentFolder.id]);
  const childFolders = useMemo(
    () => driveFolderTree.filter((node) => node.parentId === currentFolder.id),
    [currentFolder.id, driveFolderTree],
  );
  const directDocuments = useMemo(() => {
    // Before the first complete Drive snapshot (or when a canonical folder
    // was just removed), keep category documents visible instead of showing
    // a non-zero card that drills into an empty screen.
    if (!rootDriveFolder && atRoot) return documents;
    return documentsDirectlyInDriveFolder(documents, currentFolder, {
      includeUnlocated: atRoot,
      includeParentsOutside: atRoot ? subtreeFolderIds : undefined,
    });
  }, [atRoot, currentFolder, documents, rootDriveFolder, subtreeFolderIds]);
  const Icon = folder ? FOLDER_ICON[folder] : Folder;
  const iconTint = folder ? FOLDER_ICON_TINT[folder] : 'bg-slate-100 text-slate-700';
  const missing = checklistItems.filter((i) => i.status === 'missing');
  // Inline thumbnails for this folder's files — fetched once the folder opens.
  const previews = useDocumentPreviews(directDocuments);
  const currentTitle = atRoot ? rootTitle : currentFolder.name;

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <header className="flex items-center gap-2.5 border-b border-neutral-100 px-4 py-3">
        <button
          type="button"
          onClick={() => {
            if (atRoot) onBack();
            else setCurrentFolderId(currentFolder.parentId);
          }}
          aria-label={atRoot ? td('back') : td('backToParent')}
          className="focus-visible:ring-brand-gold-text/40 inline-flex min-h-9 shrink-0 items-center gap-1 rounded px-1 text-sm text-neutral-600 hover:text-neutral-900 focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronRight className="size-4 ltr:rotate-180" aria-hidden="true" />
          <span className="hidden sm:inline">{atRoot ? td('back') : td('backToParent')}</span>
        </button>
        <span className={`shrink-0 rounded-md p-1.5 ${iconTint}`}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <nav aria-label={td('breadcrumbLabel')} className="min-w-0 flex-1 overflow-x-auto">
          <ol className="flex min-w-max items-center gap-1 text-sm">
            {breadcrumb.map((crumb, index) => {
              const isCurrent = index === breadcrumb.length - 1;
              const name = crumb.id === root.id ? rootTitle : crumb.name;
              return (
                <li
                  key={crumb.id}
                  ref={isCurrent ? currentCrumbRef : undefined}
                  className="flex min-w-0 items-center gap-1"
                >
                  {index > 0 && (
                    <ChevronLeft
                      className="size-3.5 shrink-0 text-neutral-300 ltr:rotate-180"
                      aria-hidden="true"
                    />
                  )}
                  {isCurrent ? (
                    <h2
                      ref={headingRef}
                      tabIndex={-1}
                      aria-current="page"
                      className="font-display focus-visible:ring-brand-gold-text/40 max-w-56 truncate rounded-sm font-semibold text-neutral-950 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {name}
                    </h2>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCurrentFolderId(crumb.id)}
                      className="focus-visible:ring-brand-gold-text/40 max-w-40 truncate rounded-sm px-0.5 text-neutral-600 hover:text-neutral-950 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {name}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        {canUploadDocuments && atRoot && folder && onUpload && (
          <button
            type="button"
            onClick={() => onUpload(folder)}
            className="btn-gold focus-visible:ring-brand-gold-text/50 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {tc('addDocument')}
          </button>
        )}
      </header>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {td('folderOpened', { name: currentTitle })}
      </p>

      <div className="space-y-5 p-4">
        {childFolders.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {td('foldersTitle')}
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {childFolders.map((child) => {
                const count = documentsInsideDriveFolder(documents, child, driveFolderTree).length;
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => setCurrentFolderId(child.id)}
                    className="group focus-visible:ring-brand-gold-text/40 flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-start transition hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span className="rounded-md bg-slate-100 p-2 text-slate-700">
                      <Folder className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-neutral-900">
                        {child.name}
                      </span>
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-neutral-500">
                        <FileText className="size-3" aria-hidden="true" />
                        {tc('documentCount', { count })}
                      </span>
                    </span>
                    <ChevronLeft
                      className="size-4 shrink-0 text-neutral-400 ltr:rotate-180"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Files first: entering a folder shows its documents immediately as a
            Drive-style thumbnail grid. */}
        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            {td('uploadedTitle')}
          </h3>
          {directDocuments.length === 0 ? (
            <p className="rounded-lg border border-neutral-100 py-10 text-center text-sm text-neutral-500">
              {td('noFiles')}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {directDocuments.map((doc) => (
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

        {atRoot && missing.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {td('requiredTitle')}
            </h3>
            <ul className="space-y-1.5">
              {missing.map((item) => (
                <li
                  key={item.itemId}
                  className="flex items-center gap-3 rounded-md border border-rose-100 bg-rose-50/40 px-3 py-2"
                >
                  <FileWarning className="size-4 shrink-0 text-rose-500" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-900">
                    {locale === 'he' ? item.nameHe : item.nameEn}
                  </span>
                  {canUploadDocuments && folder && onUpload && (
                    <button
                      type="button"
                      onClick={() => onUpload(folder)}
                      className="text-brand-gold-text focus-visible:ring-brand-gold-text/40 inline-flex shrink-0 items-center gap-1 rounded text-xs hover:underline focus-visible:ring-2 focus-visible:outline-none"
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
