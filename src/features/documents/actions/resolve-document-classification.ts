'use server';

import { createClient } from '@/lib/supabase/server';
import { safeDbError } from '@/lib/supabase/db-error-log';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

/**
 * Advisor verdict on an AI category suggestion (ai-v2-spec.md §2.4/§2.6):
 * accept applies the suggested category through the same RLS-gated documents
 * update every manual categorization uses; reject just records the verdict
 * (calibration data for the accuracy reviews). Either way the amber chip
 * disappears — the row keeps the full provenance.
 */
export async function resolveDocumentClassificationAction(
  classificationId: string,
  verdict: 'accepted' | 'rejected',
): Promise<Result> {
  if (!classificationId || (verdict !== 'accepted' && verdict !== 'rejected')) {
    return { ok: false, error: 'validation' };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // Same permission gate as re-categorizing a document.
  const { data: canVerify } = await supabase.rpc('has_permission', { perm_key: 'verify_document' });
  const { data: canUpload } = await supabase.rpc('has_permission', { perm_key: 'upload_document' });
  if (canVerify !== true && canUpload !== true) return { ok: false, error: 'unauthorized' };

  // RLS scopes this read to documents the caller can see.
  const { data: row, error: readErr } = await supabase
    .from('document_classifications')
    .select('id, document_id, case_id, suggested_category_id, matched_borrower_id, decision, resolution')
    .eq('id', classificationId)
    .maybeSingle();
  if (readErr || !row) return { ok: false, error: 'validation' };
  if (row.decision !== 'suggested' || row.resolution !== null) {
    return { ok: false, error: 'validation' };
  }

  if (verdict === 'accepted' && row.suggested_category_id) {
    const patch: { category_id: string; borrower_id?: string } = {
      category_id: row.suggested_category_id,
    };
    if (row.matched_borrower_id) patch.borrower_id = row.matched_borrower_id;
    const { error: applyErr } = await supabase
      .from('documents')
      .update(patch)
      .eq('id', row.document_id)
      .eq('case_id', row.case_id);
    if (applyErr) {
      console.error('[resolveClassification] apply failed', safeDbError(applyErr));
      return { ok: false, error: 'unknown' };
    }
  }

  const { error: markErr } = await supabase
    .from('document_classifications')
    .update({ resolution: verdict, resolved_by: userRes.user.id, resolved_at: new Date().toISOString() })
    .eq('id', classificationId);
  if (markErr) {
    console.error('[resolveClassification] mark failed', safeDbError(markErr));
    return { ok: false, error: 'unknown' };
  }
  return { ok: true };
}
