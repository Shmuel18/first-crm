'use server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type DeleteResult = { ok: true } | { ok: false; error: 'unauthorized' | 'unknown' };

/**
 * Soft-delete an expense via the SECURITY DEFINER RPC (migration 081).
 * Same pattern as the borrower-financial delete actions — the RPC handles
 * the auth + scope check and the RLS-on-RETURNING gotcha.
 */
export async function deleteExpenseAction(
  expenseId: string,
  caseId: string,
): Promise<DeleteResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  if (!(await userCanEditCase(caseId))) {
    return { ok: false, error: 'unauthorized' };
  }

  const { data: deleted, error } = await supabase.rpc('soft_delete_case_expense', {
    p_case_id: caseId,
    p_expense_id: expenseId,
  });

  if (error) {
    console.error(
      '[deleteExpense] rpc error',
      JSON.stringify({
        expenseId,
        caseId,
        code: error.code ?? null,
        message: error.message ?? null,
      }),
    );
    return { ok: false, error: 'unknown' };
  }
  if (deleted !== true) return { ok: false, error: 'unauthorized' };

  // No revalidatePath — the client removes the row optimistically (FE-1),
  // avoiding a full case-page re-render.
  return { ok: true };
}
