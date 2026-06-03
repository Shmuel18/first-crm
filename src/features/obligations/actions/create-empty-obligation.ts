'use server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';
import { asBorrowerId, asCaseId } from '@/lib/types/branded';

import { borrowerIsOnCase } from '@/features/borrowers/services/borrowers.service';

type Result =
  | { ok: true; obligationId: string }
  | { ok: false; error: 'unauthorized' | 'unknown'; message?: string };

/**
 * Create an empty borrower_obligations row with only borrower_id set. The
 * case-level inline list renders the new row and the user fills the
 * fields cell-by-cell — no dialog. Mirrors createEmptyIncomeAction.
 */
export async function createEmptyObligationAction(
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
    .from('borrower_obligations')
    .insert({
      borrower_id: borrowerId,
      created_by: userRes.user.id,
      updated_by: userRes.user.id,
    })
    .select('id')
    .single();

  if (error || !created) {
    console.error('[createEmptyObligation] db error', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }

  // No revalidatePath — CaseObligationsClient inserts the row optimistically
  // and recomputes the total client-side, avoiding a full case-page re-render
  // (FE-1).
  return { ok: true, obligationId: created.id };
}
