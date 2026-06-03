'use server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';
import type { Database } from '@/types/database';

import {
  isEditableExpenseField,
  type EditableExpenseField,
} from '../domain/editable-expense-fields';
import { ExpenseFormShape } from '../schemas/expense.schema';

export type { EditableExpenseField } from '../domain/editable-expense-fields';

export type UpdateExpenseFieldResult =
  | { ok: true }
  | {
      ok: false;
      error: 'invalid_field' | 'validation' | 'unauthorized' | 'unknown';
      message?: string;
    };

type ExpenseUpdate = Database['public']['Tables']['case_expenses']['Update'];

/**
 * Patches a single case_expenses column. Same shape as
 * updateObligationFieldAction / updateBorrowerFieldAction — whitelist +
 * per-field Zod validator + user-can-edit gate. Errors come back as
 * generic codes; the UI maps to translated strings.
 */
export async function updateExpenseFieldAction(
  expenseId: string,
  caseId: string,
  field: string,
  rawValue: unknown,
): Promise<UpdateExpenseFieldResult> {
  if (!isEditableExpenseField(field)) {
    return { ok: false, error: 'invalid_field' };
  }
  const safeField: EditableExpenseField = field;

  const fieldSchema = ExpenseFormShape.shape[safeField];
  const parsed = fieldSchema.safeParse(rawValue);
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return {
      ok: false,
      error: 'validation',
      message: fieldErrors[safeField] ?? Object.values(fieldErrors)[0],
    };
  }

  if (!(await userCanEditCase(caseId))) {
    return { ok: false, error: 'unauthorized' };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return { ok: false, error: 'unauthorized' };
  }

  const patch = {
    [safeField]: parsed.data ?? null,
    updated_by: userRes.user.id,
  } as ExpenseUpdate;

  const { error } = await supabase
    .from('case_expenses')
    .update(patch)
    .eq('id', expenseId)
    .eq('case_id', caseId)
    .is('deleted_at', null);

  if (error) {
    console.error(
      '[updateExpenseField] update error',
      JSON.stringify({
        expenseId,
        caseId,
        field: safeField,
        code: error.code ?? null,
        message: error.message ?? null,
      }),
    );
    return { ok: false, error: 'unknown' };
  }

  // No revalidatePath — the client updates the cell optimistically (FE-1);
  // revalidating re-rendered the whole case page and lost scroll.
  return { ok: true };
}
