import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** 'raced' = someone else already soft-deleted it; the desired state holds. */
export type SoftDeleteOutcome = 'deleted' | 'raced' | 'failed';

/**
 * Soft-delete a document through the tombstoning RPC (migration 027), with the
 * race check the UI needs: a second tab (or a Drive sync) can win between our
 * existence check and the call, and that is a success, not an error.
 *
 * Lives here rather than in the action so delete-document stays inside the
 * server-action size limit.
 */
export async function softDeleteDocumentWithTombstone(
  supabase: SupabaseServerClient,
  { documentId, caseId, userId }: { documentId: string; caseId: string; userId: string },
): Promise<SoftDeleteOutcome> {
  // The RPC is on the remote DB but not surfaced by `supabase gen types` —
  // narrow the call instead of casting through unknown at the use-site.
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: 'soft_delete_document_with_tombstone',
    args: { p_document_id: string; p_case_id: string; p_user_id: string },
  ) => Promise<{ error: { message: string } | null }>;

  const { error } = await rpc('soft_delete_document_with_tombstone', {
    p_document_id: documentId,
    p_case_id: caseId,
    p_user_id: userId,
  });
  if (!error) return 'deleted';

  console.error('[softDeleteDocument] rpc failed', safeDbError(error));
  const { data: activeDoc, error: refetchErr } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .maybeSingle();

  if (refetchErr) {
    console.error('[softDeleteDocument] refetch after rpc failure failed', safeDbError(refetchErr));
    return 'failed';
  }
  return activeDoc ? 'failed' : 'raced';
}
