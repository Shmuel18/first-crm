'use server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';
import { asBorrowerId, asCaseId } from '@/lib/types/branded';

import { borrowerIsOnCase } from '@/features/borrowers/services/borrowers.service';

type Result =
  | { ok: true; incomeId: string }
  | { ok: false; error: 'unauthorized' | 'unknown'; message?: string };

/**
 * Create an empty borrower_incomes row with only borrower_id set, so the
 * inline-editable card layout can render it and the user fills the fields
 * cell-by-cell. Replaces the previous "open a dialog with empty values"
 * flow — same outcome, fewer modals.
 */
export async function createEmptyIncomeAction(
  caseId: string,
  borrowerId: string,
): Promise<Result> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };
  if (!(await borrowerIsOnCase(asCaseId(caseId), asBorrowerId(borrowerId)))) {
    return { ok: false, error: 'unauthorized' };
  }

  const { data: created, error } = await supabase
    .from('borrower_incomes')
    .insert({
      borrower_id: borrowerId,
      created_by: userRes.user.id,
      updated_by: userRes.user.id,
    })
    .select('id')
    .single();

  if (error || !created) {
    console.error('[createEmptyIncome] db error', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }

  // No revalidatePath — CaseIncomesClient inserts the row optimistically and
  // recomputes the subtotal + grand total client-side (FE-1), avoiding a full
  // case-page re-render + scroll-jump.
  return { ok: true, incomeId: created.id };
}
