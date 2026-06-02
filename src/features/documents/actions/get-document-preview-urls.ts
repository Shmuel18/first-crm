'use server';

import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { DOCUMENTS_BUCKET } from '../services/documents.service';

type Result =
  | { ok: true; urls: Record<string, string> }
  | { ok: false; error: 'unauthorized' | 'unknown' };

/** Signed-URL lifetime for grid thumbnails. Matches the single-doc preview
 *  window — long enough to browse a folder, short enough that a leaked URL
 *  expires quickly. The hook re-fetches whenever a folder is reopened. */
const THUMBNAIL_TTL_SECONDS = 300;

/** Bound the batch so one call can't fan out into an unbounded storage request. */
const MAX_BATCH = 100;

/**
 * Batch signed preview URLs for the documents grid, keyed by document id.
 * Only image/PDF docs that have a Supabase Storage blob get a URL — the card
 * uses it for an inline <img>/<iframe> thumbnail and falls back to the Drive
 * iframe / file-type icon for everything else. The id→path resolution runs
 * under the caller's RLS, so paths for documents they can't see are never
 * signed (mirrors getDocumentPreviewUrlAction's single-doc guard).
 */
export async function getDocumentPreviewUrlsAction(
  documentIds: string[],
): Promise<Result> {
  if (documentIds.length === 0) return { ok: true, urls: {} };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('view_case_documents'))) {
    return { ok: false, error: 'unauthorized' };
  }

  const { data: docs, error } = await supabase
    .from('documents')
    .select('id, mime_type, metadata')
    .in('id', documentIds.slice(0, MAX_BATCH))
    .is('deleted_at', null);
  if (error) {
    console.error('[getDocumentPreviewUrls] doc fetch failed', error);
    return { ok: false, error: 'unknown' };
  }

  // storage_path → docId, only for previewable docs that have a stored blob.
  const pathToId = new Map<string, string>();
  for (const doc of docs ?? []) {
    const mime = doc.mime_type;
    if (!mime || !(mime.startsWith('image/') || mime === 'application/pdf')) continue;
    const path =
      doc.metadata && typeof doc.metadata === 'object' && 'storage_path' in doc.metadata
        ? (doc.metadata as { storage_path?: string }).storage_path
        : undefined;
    if (path) pathToId.set(path, doc.id);
  }
  if (pathToId.size === 0) return { ok: true, urls: {} };

  const paths = [...pathToId.keys()];
  const { data: signed, error: signErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrls(paths, THUMBNAIL_TTL_SECONDS);
  if (signErr || !signed) {
    console.error('[getDocumentPreviewUrls] signed URLs failed', signErr);
    return { ok: false, error: 'unknown' };
  }

  // Result array is index-aligned with the input paths.
  const urls: Record<string, string> = {};
  signed.forEach((item, i) => {
    const path = paths[i];
    if (item.error || !item.signedUrl || !path) return;
    const id = pathToId.get(path);
    if (id) urls[id] = item.signedUrl;
  });
  return { ok: true, urls };
}
