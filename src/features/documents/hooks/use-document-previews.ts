'use client';

import { useEffect, useState } from 'react';

import { getDocumentPreviewUrlsAction } from '../actions/get-document-preview-urls';
import type { DocumentWithRelations } from '../types';

function isPreviewable(mime: string | null): boolean {
  return Boolean(mime && (mime.startsWith('image/') || mime === 'application/pdf'));
}

/**
 * Resolves Supabase signed preview URLs for the previewable (image/PDF)
 * documents in `documents`, keyed by document id. Fetched in one batched
 * server action and re-run whenever the set of previewable ids changes — e.g.
 * when a different folder is opened, since the cards mount only on drill-in.
 * Drive-only docs simply won't appear in the map and their card falls back to
 * the Drive iframe / file-type icon.
 */
export function useDocumentPreviews(
  documents: ReadonlyArray<DocumentWithRelations>,
): ReadonlyMap<string, string> {
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(() => new Map());

  const previewableIds = documents.filter((d) => isPreviewable(d.mime_type)).map((d) => d.id);
  const key = previewableIds.join(',');

  useEffect(() => {
    if (previewableIds.length === 0) return;
    let cancelled = false;
    getDocumentPreviewUrlsAction(previewableIds)
      .then((res) => {
        // setState only in the async callback — avoids react-hooks/set-state-in-effect.
        if (!cancelled && res.ok) setUrls(new Map(Object.entries(res.urls)));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // previewableIds is derived from `key`; re-run only when the id set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}
