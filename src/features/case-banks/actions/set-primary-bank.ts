'use server';

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
  // SECURITY INVOKER (migration 021), so case_banks RLS still applies
  // underneath; this app-layer check just fails fast before the RPC call.
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  // RPC handles bankId === null internally (clears primary). Supabase types
  // mark the param as non-null because PG signatures don't express
  // nullability - cast is safe per the function body in migration 021.
  const { error } = await supabase.rpc('set_primary_bank', {
    p_case_id: caseId,
    p_bank_id: bankId as string,
    p_user_id: userRes.user.id,
  });
  if (error) {
    console.error('[setPrimaryBank] rpc failed', { caseId, code: error.code });
    return { ok: false, error: 'unknown' };
  }

  // No revalidatePath: the detail page's inline banks list updates
  // optimistically on the client (case-banks-inline-list), and the dashboard
  // bank cell already manages its own optimistic state. Revalidating
  // /cases/[id] re-rendered every block and lost the user's scroll position.
  return { ok: true };
}
