'use server';

import { createClient } from '@/lib/supabase/server';
import { safeDbError } from '@/lib/supabase/db-error-log';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

/**
 * Close one triage item: acknowledged ("ראיתי, טופל") or dismissed ("לא
 * רלוונטי"). RLS enforces who may touch the row (view_ai_inbox holders, or
 * an advisor on the linked case) — an unauthorized update just matches 0 rows.
 */
export async function resolveInboxItemAction(
  itemId: string,
  verdict: 'acknowledged' | 'dismissed',
): Promise<Result> {
  if (!itemId || (verdict !== 'acknowledged' && verdict !== 'dismissed')) {
    return { ok: false, error: 'validation' };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data, error } = await supabase
    .from('email_inbox')
    .update({
      status: verdict,
      resolved_by: userRes.user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .in('status', ['needs_review', 'new', 'auto_processed'])
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[resolveInboxItem] db error', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }
  if (!data) return { ok: false, error: 'unauthorized' }; // RLS filtered or already resolved
  return { ok: true };
}
