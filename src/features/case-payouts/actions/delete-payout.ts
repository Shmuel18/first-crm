'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type DeleteResult = { ok: true } | { ok: false; error: 'unauthorized' | 'unknown' };

/**
 * Soft-delete a payout via the SECURITY DEFINER RPC (migration 186).
 * Manager-only — `view_case_fee` gate + the RPC's own is_admin() check.
 */
export async function deletePayoutAction(payoutId: string, caseId: string): Promise<DeleteResult> {
  if (!(await userHasPermission('view_case_fee'))) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const db = supabase as unknown as SupabaseClient;
  const { data: deleted, error } = await db.rpc('soft_delete_case_payout', {
    p_case_id: caseId,
    p_payout_id: payoutId,
  });

  if (error) {
    console.error('[deletePayout] rpc error', error.code);
    return { ok: false, error: 'unknown' };
  }
  if (deleted !== true) return { ok: false, error: 'unauthorized' };
  return { ok: true };
}
