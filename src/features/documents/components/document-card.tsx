'use client';

import { useState } from 'react';

import { FileText, FileType2, Image as ImageIcon, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { documentDisplayName } from '../domain/document-name';
import { RenameDocumentDialog } from './rename-document-dialog';
import type { DocumentWithRelations } from '../types';

type Props = {
  doc: DocumentWithRelations;
  caseId: string;
  /** Renaming is an edit; hidden for view-only viewers. */
  canRename: boolean;
  /** Supabase Storage signed URL for an inline thumbnail. Preferred over the
   *  Drive iframe when present — it works for every permitted user without a
   *  Google session. Resolved by useDocumentPreviews for image/PDF docs. */
  previewUrl?: string | null;
  onClick: (doc: DocumentWithRelations) => void;
};

function FileTypeIcon({ mime, className }: { mime: string | null; className?: string }) {
  if (mime?.startsWith('image/')) return <ImageIcon className={className} />;
  if (mime === 'application/pdf') return <FileText className={className} />;
  return <FileType2 className={className} />;
}

/**
 * Drive-style document tile with an inline preview so the file is recognizable
 * without opening it. Renderer precedence:
 *   1. Supabase signed URL (image → <img>, PDF → <iframe>) — the reliable path
 *      for uploaded docs; identical to what the preview modal shows.
 *   2. Google Drive `/preview` iframe — for files only mirrored to Drive
 *      (e.g. Office docs found by sync) with no local blob to sign.
 *   3. File-type icon — nothing to preview yet.
 * The preview is non-interactive; a transparent overlay keeps the whole tile
 * clickable to open the full modal.
 */
export function DocumentCard({ doc, caseId, canRename, previewUrl, onClick }: Props) {
  const t = useTranslations('documents.rename');
  const [renameOpen, setRenameOpen] = useState(false);
  // The file's own name, not its category: the office names each file
  // deliberately ("חוזה רכישה"), and a whole folder of cards reading the same
  // category name told them nothing apart.
  const label = documentDisplayName(doc.file_name);
  const isImage = doc.mime_type?.startsWith('image/') ?? false;
  const isPdf = doc.mime_type === 'application/pdf';
  const driveUrl = doc.drive_file_id
    ? `https://drive.google.com/file/d/${doc.drive_file_id}/preview`
    : null;

  return (
    <div className="group relative overflow-hidden rounded-lg border border-neutral-200 bg-white transition hover:border-brand-gold-text hover:shadow-md focus-within:ring-2 focus-within:ring-brand-gold-text/50">
      <div className="relative aspect-[4/3] overflow-hidden border-b border-neutral-100 bg-neutral-50">
        {previewUrl && isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={label}
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        ) : previewUrl && isPdf ? (
          <iframe
            src={previewUrl}
            title={doc.file_name}
            loading="lazy"
            tabIndex={-1}
            className="pointer-events-none absolute inset-0 size-full border-0"
          />
        ) : driveUrl ? (
          <iframe
            src={driveUrl}
            title={doc.file_name}
            loading="lazy"
            tabIndex={-1}
            className="pointer-events-none absolute inset-0 size-full border-0"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <FileTypeIcon mime={doc.mime_type} className="size-10 text-neutral-300" />
          </div>
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-xs font-medium text-neutral-900">{label}</p>
      </div>
      {/* Transparent click target over the whole tile — the preview is
          non-interactive, so clicking anywhere opens the full modal. */}
      <button
        type="button"
        onClick={() => onClick(doc)}
        title={doc.file_name}
        aria-label={label}
        className="absolute inset-0 z-20 focus:outline-none"
      />
      {/* Above the tile-wide click target (z-20) so the pencil doesn't just
          open the preview. */}
      {canRename && (
        <button
          type="button"
          onClick={() => setRenameOpen(true)}
          aria-label={t('action')}
          title={t('action')}
          className="absolute bottom-1.5 end-1.5 z-30 rounded-md bg-white/90 p-1 text-neutral-500 opacity-0 shadow-sm transition hover:text-brand-gold-text focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40 group-hover:opacity-100"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </button>
      )}
      {renameOpen && (
        <RenameDocumentDialog
          open={renameOpen}
          onOpenChange={setRenameOpen}
          documentId={doc.id}
          caseId={caseId}
          fileName={doc.file_name}
        />
      )}
    </div>
  );
}
