'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true; expenseId: string }
  | { ok: false; error: 'unauthorized' | 'unknown' };

/**
 * Inserts an empty case_expenses row attached to the given case. Backs the
 * "+ הוצאה" button on the admin block — same pattern as
 * createEmptyObligationAction: get a blank row instantly, fill the date /
 * amount / description inline.
 */
export async function createEmptyExpenseAction(caseId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  if (!(await userCanEditCase(caseId))) {
    return { ok: false, error: 'unauthorized' };
  }

  const { data, error } = await supabase
    .from('case_expenses')
    .insert({
      case_id: caseId,
      created_by: userRes.user.id,
      updated_by: userRes.user.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error(
      '[createEmptyExpense] insert error',
      JSON.stringify({
        caseId,
        code: error?.code ?? null,
        message: error?.message ?? null,
      }),
    );
    return { ok: false, error: 'unknown' };
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true, expenseId: data.id };
}
