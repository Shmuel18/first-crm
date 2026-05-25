'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { asBorrowerId, asCaseId } from '@/lib/types/branded';
import type { Database } from '@/types/database';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { IncomeFormSchema } from '../schemas/income.schema';
import { borrowerIsOnCase } from '../services/incomes.service';

type IncomeUpdate = Database['public']['Tables']['borrower_incomes']['Update'];

/**
 * Whitelist of borrower_incomes columns the inline-editable row may patch.
 * borrower_id is excluded — an income's borrower is set at creation and
 * shouldn't move between borrowers via this endpoint.
 */
const EDITABLE_FIELDS = [
  'income_type_id',
  'amount_monthly',
  'source_name',
  'tenure_months',
  'is_primary',
  'notes',
] as const satisfies readonly (keyof typeof IncomeFormSchema.shape)[];

export type EditableIncomeField = (typeof EDITABLE_FIELDS)[number];

export type UpdateIncomeFieldResult =
  | { ok: true }
  | {
      ok: false;
      error: 'invalid_field' | 'validation' | 'unauthorized' | 'unknown';
      message?: string;
    };

export async function updateIncomeFieldAction(
  incomeId: string,
  caseId: string,
  field: string,
  rawValue: unknown,
): Promise<UpdateIncomeFieldResult> {
  if (!(EDITABLE_FIELDS as readonly string[]).includes(field)) {
    return { ok: false, error: 'invalid_field' };
  }
  const safeField = field as EditableIncomeField;

  // Reuse the same per-field Zod the create/full-save action uses.
  const fieldSchema = IncomeFormSchema.shape[safeField];
  const parsed = fieldSchema.safeParse(rawValue);
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return {
      ok: false,
      error: 'validation',
      message: fieldErrors[safeField] ?? Object.values(fieldErrors)[0],
    };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  // Look up the income's owning borrower so we can verify it actually belongs
  // to one of THIS case's borrowers — defends against a caller with edit
  // rights on case A trying to patch case B's income by passing case A's id.
  const { data: income } = await supabase
    .from('borrower_incomes')
    .select('borrower_id')
    .eq('id', incomeId)
    .maybeSingle();
  if (!income) return { ok: false, error: 'unauthorized' };
  if (!(await borrowerIsOnCase(asCaseId(caseId), asBorrowerId(income.borrower_id)))) {
    return { ok: false, error: 'unauthorized' };
  }

  const updatePayload = {
    [safeField]: parsed.data,
    updated_by: userRes.user.id,
  } as IncomeUpdate;

  const { data: updated, error } = await supabase
    .from('borrower_incomes')
    .update(updatePayload)
    .eq('id', incomeId)
    .select('id');

  if (error) return { ok: false, error: 'unknown', message: error.message };
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
