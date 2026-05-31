'use server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';
import type { Database } from '@/types/database';

import {
  isEditableCaseBankField,
  type EditableCaseBankField,
} from '../domain/editable-case-bank-fields';
import { CaseBankFormSchema } from '../schemas/case-bank.schema';

export type { EditableCaseBankField } from '../domain/editable-case-bank-fields';

export type UpdateCaseBankFieldResult =
  | { ok: true }
  | {
      ok: false;
      error: 'invalid_field' | 'validation' | 'unauthorized' | 'unknown' | 'already_linked';
      message?: string;
    };

type CaseBankUpdate = Database['public']['Tables']['case_banks']['Update'];

/**
 * Inline patch for a single case_banks column from the admin block's
 * banks list. Same shape as updateCaseFieldAction / updateBorrowerFieldAction
 * — whitelist + per-field Zod validator + user-can-edit gate.
 *
 * Errors return generic codes (UI maps to translated strings). The
 * "already_linked" case fires when the user swaps bank_id to a bank
 * that's already on the case (case_banks UNIQUE(case_id, bank_id)).
 */
export async function updateCaseBankFieldAction(
  caseBankId: string,
  caseId: string,
  field: string,
  rawValue: unknown,
): Promise<UpdateCaseBankFieldResult> {
  if (!isEditableCaseBankField(field)) {
    return { ok: false, error: 'invalid_field' };
  }
  const safeField: EditableCaseBankField = field;

  const fieldSchema = CaseBankFormSchema.shape[safeField];
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
  } as CaseBankUpdate;

  const { error } = await supabase
    .from('case_banks')
    .update(patch)
    .eq('id', caseBankId)
    .eq('case_id', caseId)
    .is('deleted_at', null);

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'already_linked' };
    }
    console.error(
      '[updateCaseBankField] update error',
      JSON.stringify({
        caseBankId,
        caseId,
        field: safeField,
        code: error.code ?? null,
        message: error.message ?? null,
      }),
    );
    return { ok: false, error: 'unknown' };
  }

  // No revalidatePath — the row shows the edited value from its own local
  // state (case-bank-inline-row); the saved value flows back on the next load.
  return { ok: true };
}
