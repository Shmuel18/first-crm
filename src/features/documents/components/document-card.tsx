'use client';

import { useState } from 'react';

import { FileText, FileType2, Image as ImageIcon, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { documentDisplayName } from '../domain/document-name';
import { MAX_THUMBNAIL_BYTES, isInlineRenderable } from '../domain/inline-renderable';
import { PdfPageCanvas } from './pdf-page-canvas';
import { RenameDocumentDialog } from './rename-document-dialog';
import type { DocumentWithRelations } from '../types';

type Props = {
  doc: DocumentWithRelations;
  caseId: string;
  /** Renaming is an edit; hidden for view-only viewers. */
  canRename: boolean;
  onClick: (doc: DocumentWithRelations) => void;
};

function FileTypeIcon({ mime, className }: { mime: string | null; className?: string }) {
  if (mime?.startsWith('image/')) return <ImageIcon className={className} />;
  if (mime === 'application/pdf') return <FileText className={className} />;
  return <FileType2 className={className} />;
}

/**
 * Drive-style document tile with an inline preview so the file is recognizable
 * without opening it. Two tiers only:
 *   1. Our own /api/documents/[id]/download bytes — image → <img>, PDF →
 *      <iframe> — for the types the route serves inline and files small enough
 *      to be worth streaming for a tile.
 *   2. File-type icon — everything else: Office formats (no browser renders
 *      them), oversized files, and anything the route would hand back as
 *      octet-stream. Office tiles used to come from a Drive iframe; that
 *      viewer needs third-party cookies and is dead on iOS.
 * The preview is non-interactive; a transparent overlay keeps the whole tile
 * clickable to open the full modal.
 */
export function DocumentCard({ doc, caseId, canRename, onClick }: Props) {
  const t = useTranslations('documents.rename');
  const [renameOpen, setRenameOpen] = useState(false);
  // The file's own name, not its category: the office names each file
  // deliberately ("חוזה רכישה"), and a whole folder of cards reading the same
  // category name told them nothing apart.
  const label = documentDisplayName(doc.file_name);
  const isPdf = doc.mime_type === 'application/pdf';
  const isImage = !isPdf && isInlineRenderable(doc.mime_type);
  // Thumbnails come from OUR origin, for both sources of bytes. The signed
  // Storage URL and the Drive viewer are both third-party requests, and both
  // fail in the office: Safari blocks Drive's cookies outright, and the
  // network filter eats raw file responses from other hosts — which is what
  // turned a folder of documents into a grid of broken-image icons.
  //
  // Two limits keep that honest. Only types the route actually serves inline
  // get a tile (anything else comes back as octet-stream and would render as a
  // broken image), and a large file is not streamed through the server just to
  // fill a 200px tile — it shows its file-type icon and still previews in full
  // when opened. Office files lost their Drive-iframe tile with them: that
  // iframe is unusable on iOS, which is the reason for this whole change.
  const tooBigForTile = (doc.file_size ?? 0) > MAX_THUMBNAIL_BYTES;
  const thumbUrl =
    (isImage || isPdf) && !tooBigForTile
      ? `/api/documents/${encodeURIComponent(doc.id)}/download`
      : null;

  return (
    <div className="group relative overflow-hidden rounded-lg border border-neutral-200 bg-white transition hover:border-brand-gold-text hover:shadow-md focus-within:ring-2 focus-within:ring-brand-gold-text/50">
      <div className="relative aspect-[4/3] overflow-hidden border-b border-neutral-100 bg-neutral-50">
        {thumbUrl && isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={label}
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        ) : thumbUrl && isPdf ? (
          <PdfPageCanvas
            src={thumbUrl}
            width={320}
            className="pointer-events-none absolute inset-0 size-full overflow-hidden [&>canvas]:size-full [&>canvas]:object-cover"
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
