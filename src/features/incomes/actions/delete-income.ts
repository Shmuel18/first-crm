'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
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

  const { data: deleted, error } = await supabase
    .from('borrower_incomes')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userRes.user.id,
      updated_by: userRes.user.id,
    })
    .eq('id', incomeId)
    .eq('borrower_id', borrowerId)
    .is('deleted_at', null)
    .select('id');

  if (error) return { ok: false, error: 'unknown' };
  if (!deleted || deleted.length === 0) return { ok: false, error: 'unauthorized' };

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
