'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

import { z } from 'zod';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

import { trashDriveCopy } from '../services/drive-document-removal.service';
import { softDeleteDocumentWithTombstone } from '../services/soft-delete-document.service';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'unknown'; message?: string };

const DeleteDocumentSchema = z.object({
  documentId: z.string().uuid(),
  caseId: z.string().uuid(),
});

// Only mark the parent case path stale (light). The heavy current-route
// (/cases/[id]/documents) revalidate + refresh() re-rendered into the POST response
// and froze the delete-confirm; the DocumentPreviewModal calls router.refresh() after
// it closes instead.
function refreshDocumentViews(caseId: string) {
  revalidatePath(`/cases/${caseId}`);
}

/**
 * Soft-delete: stamp documents.deleted_at and STOP. The blob in Supabase
 * Storage (and the Drive file, if any) stay put until retention purge runs.
 *
 * Why not delete blobs here?
 *   - Restore within the retention window must remain possible (#12). The
 *     previous version destroyed the blob immediately, making restore a
 *     manual SQL job.
 *   - Failures in the blob delete used to block the DB update, leaving the
 *     UI inconsistent with the actual store.
 *
 * Retention purge: the /api/cron/cleanup-orphaned-blobs job (retention-file-
 * eraser) erases the Storage blob + Drive copy once past the retention window,
 * and cleanup_soft_deleted_records (migration 139) hard-deletes the row only
 * after BOTH pointers are gone (or past the backstop) — so soft-deleting here
 * leaves the files recoverable until then, with no permanent orphan.
 */
export async function deleteDocumentAction(
  documentId: string,
  caseId: string,
): Promise<Result> {
  const parsed = DeleteDocumentSchema.safeParse({ documentId, caseId });
  if (!parsed.success) return { ok: false, error: 'not_found' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('delete_document'))) {
    return { ok: false, error: 'unauthorized' };
  }
  if (!(await userCanEditCase(parsed.data.caseId))) {
    return { ok: false, error: 'unauthorized' };
  }

  // Defense-in-depth: doc must belong to the supplied case + still exist.
  // drive_file_id is read here, before the delete clears it, so the Drive copy
  // can be binned afterwards.
  const { data: doc, error: fetchErr } = await supabase
    .from('documents')
    .select('id, drive_file_id')
    .eq('id', parsed.data.documentId)
    .eq('case_id', parsed.data.caseId)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchErr) {
    console.error('[deleteDocument] fetch failed', safeDbError(fetchErr));
    return { ok: false, error: 'unknown' };
  }
  if (!doc) {
    // Delete is intentionally idempotent: if another tab/session already
    // soft-deleted the row, clear the stale preview instead of surfacing a
    // false failure to the user.
    refreshDocumentViews(parsed.data.caseId);
    return { ok: true };
  }

  const outcome = await softDeleteDocumentWithTombstone(supabase, {
    documentId: parsed.data.documentId,
    caseId: parsed.data.caseId,
    userId: userRes.user.id,
  });
  if (outcome === 'failed') return { ok: false, error: 'unknown' };
  if (outcome === 'raced') {
    // Already gone by another path; the UI just needs fresh data.
    refreshDocumentViews(parsed.data.caseId);
    return { ok: true };
  }

  // Mirror the delete into Drive so the folder matches what the app shows.
  // after() because it's an external HTTP call: the dialog must not wait on
  // Drive, and a Drive failure must not fail a delete that already committed.
  if (doc.drive_file_id) {
    after(async () => {
      const trashed = await trashDriveCopy(doc.drive_file_id);
      if (!trashed) {
        console.error('[deleteDocument] Drive copy not binned', {
          documentId: parsed.data.documentId,
        });
      }
    });
  }

  refreshDocumentViews(parsed.data.caseId);
  return { ok: true };
}
