'use server';

import { createClient } from '@/lib/supabase/server';
import { safeDbError } from '@/lib/supabase/db-error-log';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'unknown'; message?: string };

export async function assignDocumentCategoryAction(
  documentId: string,
  caseId: string,
  categoryId: string,
): Promise<Result> {
  if (!documentId || !categoryId) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // Same permission gate the other doc actions use: verifying a doc
  // (including re-categorizing) requires verify_document or upload_document.
  const { data: hasPerm } = await supabase.rpc('has_permission', {
    perm_key: 'verify_document',
  });
  const { data: hasUploadPerm } = await supabase.rpc('has_permission', {
    perm_key: 'upload_document',
  });
  if (hasPerm !== true && hasUploadPerm !== true) {
    return { ok: false, error: 'unauthorized' };
  }

  const { error } = await supabase
    .from('documents')
    .update({ category_id: categoryId })
    .eq('id', documentId)
    .eq('case_id', caseId); // defense-in-depth: doc must belong to the supplied case

  if (error) {
    console.error('[assignDocumentCategory] db error', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }

  // No revalidatePath: re-rendering the heavy documents page into the POST response
  // kept the <select> disabled with a spinner ~1s to categorize one document. The row
  // hides itself optimistically and calls router.refresh() in the background instead.
  return { ok: true };
}
