'use server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true; expenseId: string }
  | { ok: false; error: 'unauthorized' | 'unknown' };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Inserts an empty case_expenses row attached to the given case. Backs the
 * "+ הוצאה" button on the admin block — same pattern as
 * createEmptyObligationAction: get a blank row instantly, fill the date /
 * amount / description inline. The date pre-fills to today (a transaction date),
 * still fully editable; the client passes its Israel-local today so server (UTC)
 * and client agree near midnight.
 */
export async function createEmptyExpenseAction(
  caseId: string,
  expenseDate: string | null = null,
): Promise<Result> {
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
      expense_date: expenseDate && ISO_DATE.test(expenseDate) ? expenseDate : null,
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

  // No revalidatePath — CaseExpensesList inserts the row optimistically (FE-1),
  // avoiding a full case-page re-render + scroll-jump.
  return { ok: true, expenseId: data.id };
}
