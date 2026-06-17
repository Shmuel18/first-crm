'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true; payoutId: string }
  | { ok: false; error: 'unauthorized' | 'unknown' };

/**
 * Inserts a blank case_payouts row (the "+ הוסף עמלה" button). Manager-only —
 * gated by `view_case_fee` at the app layer; RLS is_admin() (migration 186) is
 * the hard enforcement. Same optimistic pattern as createEmptyExpenseAction.
 */
export async function createEmptyPayoutAction(caseId: string): Promise<Result> {
  if (!(await userHasPermission('view_case_fee'))) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from('case_payouts')
    .insert({ case_id: caseId, created_by: userRes.user.id, updated_by: userRes.user.id })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[createEmptyPayout] insert error', error?.code);
    return { ok: false, error: 'unknown' };
  }
  return { ok: true, payoutId: (data as { id: string }).id };
}
