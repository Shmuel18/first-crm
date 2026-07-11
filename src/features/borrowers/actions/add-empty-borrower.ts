'use server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

/**
 * Adds an empty borrower row + links it to the case. Used by the inline
 * "+ הוסף לווה" button on the live case-detail page: click → new empty
 * card appears at the bottom of the borrowers list, ready for inline
 * editing via the existing CaseBorrowerCard machinery.
 *
 * Goes through the atomic add_empty_borrower_to_case RPC (migration 190):
 * the borrower row + case_borrowers junction + primary-sync commit or roll
 * back together (no orphan borrower on partial failure), and the RPC's
 * _assert_can_edit_case guard lets any advisor who can edit the case
 * (responsible OR associated) add a borrower — the previous direct INSERT
 * into public.borrowers was RLS-restricted to edit_any_case (admin) by
 * borrowers_modify (migration 064), silently failing for regular advisors.
 *
 * Returns Result. Failures: missing auth, lacks edit rights, or DB error.
 * No raw Supabase messages bubble out — the UI maps codes to translated strings.
 */
export type AddEmptyBorrowerResult =
  | { ok: true; borrowerId: string }
  | { ok: false; error: 'unauthorized' | 'unknown' };

export async function addEmptyBorrowerAction(
  caseId: string,
): Promise<AddEmptyBorrowerResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return { ok: false, error: 'unauthorized' };
  }

  // Fast app-layer gate (defense-in-depth; the RPC re-asserts the same rule).
  if (!(await userCanEditCase(caseId))) {
    return { ok: false, error: 'unauthorized' };
  }

  // database.ts predates migration 190; minimal cast (same pattern as
  // lib/rate-limit.ts / lib/auth/session.ts). Regenerate types to drop it.
  const rpcClient = supabase as unknown as {
    rpc(
      fn: 'add_empty_borrower_to_case',
      args: { p_case_id: string },
    ): PromiseLike<{ data: string | null; error: { code?: string; message: string } | null }>;
  };
  const { data: borrowerId, error } = await rpcClient.rpc('add_empty_borrower_to_case', {
    p_case_id: caseId,
  });

  if (error || !borrowerId) {
    console.error('[addEmptyBorrower] rpc failed', { caseId, code: error?.code });
    // 42501 = the RPC's _assert_can_edit_case refused (race: edit rights lost
    // between the app check and the RPC). Everything else is a generic failure.
    return { ok: false, error: error?.code === '42501' ? 'unauthorized' : 'unknown' };
  }

  // No revalidatePath: it re-rendered the heavy /cases/[id] into the POST response,
  // so the button spun ~1-1.6s for a single empty row. The consumer (AddBorrowerButton)
  // calls router.refresh() after this returns — the new card streams in in the
  // background while the button releases immediately. Mirrors the task create/edit fix.
  return { ok: true, borrowerId };
}
