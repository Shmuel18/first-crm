'use server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { asBorrowerId, asCaseId } from '@/lib/types/branded';

import { borrowerIsOnCase } from '@/features/borrowers/services/borrowers.service';

type DeleteResult = { ok: true } | { ok: false; error: 'unauthorized' | 'unknown' };

export async function deleteIncomeAction(
  incomeId: string,
  borrowerId: string,
  caseId: string,
): Promise<DeleteResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };
  if (!(await borrowerIsOnCase(asCaseId(caseId), asBorrowerId(borrowerId)))) {
    return { ok: false, error: 'unauthorized' };
  }

  const { data: deleted, error } = await supabase.rpc('soft_delete_borrower_income', {
    p_case_id: caseId,
    p_income_id: incomeId,
  });

  if (error) {
    console.error(
      '[deleteIncome] rpc error',
      JSON.stringify({ incomeId, borrowerId, caseId, ...safeDbError(error) }),
    );
    return { ok: false, error: 'unknown' };
  }
  if (deleted !== true) return { ok: false, error: 'unauthorized' };

  // No revalidatePath — the client removes the row + recomputes totals
  // optimistically (FE-1), avoiding a full case-page re-render.
  return { ok: true };
}
