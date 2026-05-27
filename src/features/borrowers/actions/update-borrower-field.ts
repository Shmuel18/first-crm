'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { asBorrowerId, asCaseId } from '@/lib/types/branded';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import {
  isEditableBorrowerField,
  type EditableBorrowerField,
} from '../domain/editable-fields';
import { BorrowerFormSchema } from '../schemas/borrower.schema';
import { borrowerIsOnCase } from '../services/borrowers.service';

export type { EditableBorrowerField } from '../domain/editable-fields';

export type UpdateBorrowerFieldResult =
  | { ok: true }
  | {
      ok: false;
      error: 'invalid_field' | 'validation' | 'unauthorized' | 'unknown';
      message?: string;
    };

/**
 * Update a single borrower field. The app validates the field and the DB
 * re-checks the explicit case scope through update_borrower_in_case.
 */
export async function updateBorrowerFieldAction(
  borrowerId: string,
  caseId: string,
  field: string,
  rawValue: unknown,
): Promise<UpdateBorrowerFieldResult> {
  if (!isEditableBorrowerField(field)) {
    return { ok: false, error: 'invalid_field' };
  }
  const safeField: EditableBorrowerField = field;

  const fieldSchema = BorrowerFormSchema.shape[safeField];
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
  if (!(await borrowerIsOnCase(asCaseId(caseId), asBorrowerId(borrowerId)))) {
    return { ok: false, error: 'unauthorized' };
  }

  const { data: updated, error } = await supabase.rpc('update_borrower_in_case', {
    p_case_id: caseId,
    p_borrower_id: borrowerId,
    p_patch: { [safeField]: parsed.data ?? null },
  });

  if (error) {
    console.error(
      '[updateBorrowerField] update error',
      JSON.stringify({
        caseId,
        borrowerId,
        field: safeField,
        code: error.code ?? null,
        message: error.message ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
      }),
    );
    return { ok: false, error: 'unknown' };
  }
  if (updated !== true) {
    return { ok: false, error: 'unauthorized' };
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
