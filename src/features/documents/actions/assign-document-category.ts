'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

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
    .eq('id', documentId);

  if (error) return { ok: false, error: 'unknown', message: error.message };

  revalidatePath(`/cases/${caseId}/documents`);
  return { ok: true };
}
