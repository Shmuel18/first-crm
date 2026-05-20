'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: string };

/**
 * Sets the primary bank for a case via an atomic RPC (see migration 021).
 * The RPC clears any existing primary, then either updates an existing
 * case_banks row or inserts a new one - all inside a single PG function
 * call so the case never observes a no-primary intermediate state.
 */
export async function setPrimaryBankAction(
  caseId: string,
  bankId: string | null,
): Promise<Result> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // Defense-in-depth: caller must be able to edit the case. The RPC is
  // SECURITY DEFINER (migration 021) so it bypasses RLS — this is the only
  // app-layer authorization gate.
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  // RPC handles bankId === null internally (clears primary). Supabase types
  // mark the param as non-null because PG signatures don't express
  // nullability - cast is safe per the function body in migration 021.
  const { error } = await supabase.rpc('set_primary_bank', {
    p_case_id: caseId,
    p_bank_id: bankId as string,
    p_user_id: userRes.user.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/cases');
  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
