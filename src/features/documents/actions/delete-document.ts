'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

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
 * only deletes the DB row; a follow-up storage-side purge job is TODO.
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

  // Defense-in-depth: doc must belong to the supplied case + still exist.
  const { data: doc, error: fetchErr } = await supabase
    .from('documents')
    .select('id')
    .eq('id', parsed.data.documentId)
    .eq('case_id', parsed.data.caseId)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: 'unknown', message: fetchErr.message };
  if (!doc) return { ok: false, error: 'not_found' };

  const { error: deleteErr } = await supabase.rpc('soft_delete_document_with_tombstone', {
    p_document_id: parsed.data.documentId,
    p_case_id: parsed.data.caseId,
    p_user_id: userRes.user.id,
  });

  if (deleteErr) return { ok: false, error: 'unknown', message: deleteErr.message };

  revalidatePath(`/cases/${parsed.data.caseId}/documents`);
  revalidatePath(`/cases/${parsed.data.caseId}`);
  return { ok: true };
}
