'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

import { PostCaseCommentSchema } from '../schemas/case-comment.schema';

type Result =
  | {
      ok: true;
      comment: { id: string; createdAt: string };
      celebrationEnabled: boolean;
    }
  | { ok: false; error: 'validation' | 'unauthorized' | 'unknown' };

/**
 * Post an internal team comment on a case. The body is stored raw and ALWAYS
 * rendered as text (React escapes it), so there's no HTML-injection surface to
 * sanitize. Visibility/authorship are enforced by the case_comments RLS
 * (insert requires can_view_case + author_id = auth.uid()).
 *
 * No revalidatePath: the case page is heavy and revalidating it scroll-jumps
 * the whole page — the thread appends optimistically and the DB is the source
 * of truth on the next full load (see feedback_optimistic_inline_mutations).
 */
export async function postCaseCommentAction(caseId: string, body: string): Promise<Result> {
  const parsed = PostCaseCommentSchema.safeParse({ caseId, body });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // case_comments isn't in the generated types yet (migration 107) — untyped handle.
  const db = supabase as unknown as SupabaseClient;
  // Fetch the global switch alongside the insert so it adds no sequential
  // round-trip. Returning the current value makes the manager's toggle apply
  // even to case pages that another teammate already had open.
  const [insertResult, settingResult] = await Promise.all([
    db
      .from('case_comments')
      .insert({
        case_id: parsed.data.caseId,
        author_id: userRes.user.id,
        body: parsed.data.body,
      })
      .select('id, created_at')
      .single(),
    supabase
      .from('office_settings')
      .select('documentation_celebrations_enabled')
      .eq('id', 1)
      .maybeSingle(),
  ]);

  const { data, error } = insertResult;

  if (error || !data) {
    // Includes the RLS rejection path (caller can't view the case). Return a
    // generic code — don't leak which gate failed.
    console.error('[postCaseComment] insert failed', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }

  const row = data as { id: string; created_at: string };
  if (settingResult.error) {
    console.error('[postCaseComment] celebration setting read failed', {
      code: settingResult.error.code,
    });
  }
  return {
    ok: true,
    comment: { id: row.id, createdAt: row.created_at },
    // Fail open so a transient setting read cannot silently remove an existing
    // success acknowledgement. A confirmed manager choice of false disables it.
    celebrationEnabled: settingResult.data?.documentation_celebrations_enabled !== false,
  };
}
