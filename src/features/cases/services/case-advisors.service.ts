import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';

/**
 * Data access for case_associated_advisors (migration 146 — the "יועץ משוייך"
 * join). The table isn't in the generated Database types yet, so it's reached
 * through an untyped client view. RLS (mig 146) is the real guard; the actions
 * also verify `assign_case_to_user` up front.
 */
async function associatedAdvisorsTable() {
  const supabase = await createClient();
  return (supabase as unknown as SupabaseClient).from('case_associated_advisors');
}

export type InsertAssociatedResult = { ok: true; duplicate: boolean } | { ok: false };

export async function insertAssociatedAdvisor(
  caseId: string,
  advisorId: string,
  addedBy: string,
): Promise<InsertAssociatedResult> {
  const table = await associatedAdvisorsTable();
  const { error } = await table.insert({
    case_id: caseId,
    advisor_id: advisorId,
    added_by: addedBy,
  });
  if (error) {
    // 23505 = unique_violation → already associated; idempotent success.
    if (error.code === '23505') return { ok: true, duplicate: true };
    console.error('[insertAssociatedAdvisor] db error', { code: error.code });
    return { ok: false };
  }
  return { ok: true, duplicate: false };
}

export async function deleteAssociatedAdvisor(
  caseId: string,
  advisorId: string,
): Promise<boolean> {
  const table = await associatedAdvisorsTable();
  // .select() row-count guard: an RLS-denied delete affects 0 rows with no
  // error — treat that as a failed (unauthorized) delete.
  const { data, error } = await table
    .delete()
    .eq('case_id', caseId)
    .eq('advisor_id', advisorId)
    .select('case_id');
  if (error) {
    console.error('[deleteAssociatedAdvisor] db error', { code: error.code });
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}
