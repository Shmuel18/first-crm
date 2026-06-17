import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import type { CaseId } from '@/lib/types/branded';

import type { CasePayoutRow } from '../types';

// Explicit column list (never select('*')) mirroring CasePayoutRow. case_payouts
// isn't in the generated Database types yet, so the read goes through an
// untyped handle — same pattern as case-properties / case-comments.
const PAYOUT_COLUMNS =
  'id, case_id, recipient, amount, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by' as const;

/**
 * Active (non-soft-deleted) payouts for a case, newest first. RLS is
 * manager-only (is_admin, migration 186) — a non-admin read returns [].
 */
export async function listCasePayouts(caseId: CaseId): Promise<CasePayoutRow[]> {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data, error } = await db
    .from('case_payouts')
    .select(PAYOUT_COLUMNS)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[listCasePayouts] select error', error.code);
    return [];
  }
  return (data ?? []) as unknown as CasePayoutRow[];
}
