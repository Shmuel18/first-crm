'use server';

import { refresh, revalidatePath } from 'next/cache';

import { z } from 'zod';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'unknown'; message?: string };

const DeleteDocumentSchema = z.object({
  documentId: z.string().uuid(),
  caseId: z.string().uuid(),
});

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
 * Retention purge (cleanup_soft_deleted_records, migration 022) currently
 * only deletes the DB row. A storage-side purge job that drops the orphaned
 * blob from Supabase Storage + the Drive file lives on the deferred list
 * — until that lands, blobs accumulate at the bucket's own retention rate.
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
  const { data: doc, error: fetchErr } = await supabase
    .from('documents')
    .select('id')
    .eq('id', parsed.data.documentId)
    .eq('case_id', parsed.data.caseId)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchErr) {
    console.error('[deleteDocument] fetch failed', fetchErr);
    return { ok: false, error: 'unknown' };
  }
  if (!doc) {
    // Delete is intentionally idempotent: if another tab/session already
    // soft-deleted the row, clear the stale preview instead of surfacing a
    // false failure to the user.
    revalidatePath(`/cases/${parsed.data.caseId}/documents`);
    revalidatePath(`/cases/${parsed.data.caseId}`);
    refresh();
    return { ok: true };
  }

  // soft_delete_document_with_tombstone (migration 027) is on the remote
  // DB but not surfaced by `supabase gen types` — narrow the call instead
  // of casting through unknown at the use-site of `error`.
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: 'soft_delete_document_with_tombstone',
    args: { p_document_id: string; p_case_id: string; p_user_id: string },
  ) => Promise<{ error: { message: string } | null }>;

  const { error: deleteErr } = await rpc('soft_delete_document_with_tombstone', {
    p_document_id: parsed.data.documentId,
    p_case_id: parsed.data.caseId,
    p_user_id: userRes.user.id,
  });

  if (deleteErr) {
    console.error('[deleteDocument] rpc failed', deleteErr);
    return { ok: false, error: 'unknown' };
  }

  revalidatePath(`/cases/${parsed.data.caseId}/documents`);
  revalidatePath(`/cases/${parsed.data.caseId}`);
  refresh();
  return { ok: true };
}
