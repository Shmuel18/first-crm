'use server';

import { after } from 'next/server';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

import { classifyDocumentInBackground } from '../services/ai-classification.service';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'rate_limited' | 'unknown' };

/**
 * Manual "classify now" re-run for one document (ai-v2-spec.md §2.6) — e.g.
 * after replacing a blurry scan. The heavy work runs AFTER the response; the
 * documents grid picks the result up on refresh.
 */
export async function runDocumentClassificationAction(
  documentId: string,
  caseId: string,
): Promise<Result> {
  if (!documentId || !caseId) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // Same gate as categorize/upload: this can end up changing the category.
  if (!(await userHasPermission('upload_document')) || !(await userCanEditCase(caseId))) {
    return { ok: false, error: 'unauthorized' };
  }

  // Each run costs a model call over a full document — cap per user.
  const allowed = await checkRateLimit({
    action: 'ai-doc-classify',
    subject: `user:${userRes.user.id}`,
    max: 30,
    windowSeconds: 3600,
  });
  if (!allowed) return { ok: false, error: 'rate_limited' };

  // Ownership sanity: the document must belong to the case the caller named.
  const { data: doc } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('case_id', caseId)
    .maybeSingle();
  if (!doc) return { ok: false, error: 'validation' };

  after(async () => {
    await classifyDocumentInBackground(documentId);
  });
  return { ok: true };
}
