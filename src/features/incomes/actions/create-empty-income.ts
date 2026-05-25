'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { asBorrowerId, asCaseId } from '@/lib/types/branded';

import { borrowerIsOnCase } from '../services/incomes.service';

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
    console.error('[createEmptyIncome] db error', error);
    return { ok: false, error: 'unknown' };
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true, incomeId: created.id };
}
