'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { asBorrowerId, asCaseId } from '@/lib/types/branded';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';
import type { Database } from '@/types/database';

import {
  isEditableBorrowerField,
  type EditableBorrowerField,
} from '../domain/editable-fields';
import { BorrowerFormSchema } from '../schemas/borrower.schema';
import { borrowerIsOnCase } from '../services/borrowers.service';

export type { EditableBorrowerField } from '../domain/editable-fields';

type BorrowerUpdate = Database['public']['Tables']['borrowers']['Update'];

export type UpdateBorrowerFieldResult =
  | { ok: true }
  | {
      ok: false;
      error: 'invalid_field' | 'validation' | 'unauthorized' | 'unknown';
      message?: string;
    };

/**
 * Update a single borrower field. Validates the value with the same Zod
 * primitive the full form uses, so an inline edit and a full-form save
 * share one rule set.
 */
export async function updateBorrowerFieldAction(
  borrowerId: string,
  caseId: string,
  field: string,
  rawValue: unknown,
): Promise<UpdateBorrowerFieldResult> {
  // Field name must be on the whitelist — never trust the client.
  if (!isEditableBorrowerField(field)) {
    return { ok: false, error: 'invalid_field' };
  }
  const safeField: EditableBorrowerField = field;

  // Run only the per-field validator. `safeParse` on the slice rather than
  // the whole schema avoids spurious "required" errors on the other 20 fields.
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

  // Auth: signed in + can edit this case + the borrower really belongs to it.
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };
  if (!(await borrowerIsOnCase(asCaseId(caseId), asBorrowerId(borrowerId)))) {
    return { ok: false, error: 'unauthorized' };
  }

  // The field name is restricted to a typed union (EditableBorrowerField),
  // so the dynamic key is always a real borrowers column. Supabase's typed
  // .update() rejects Record<string, unknown>, so we narrow via assertion —
  // the runtime guarantee is the whitelist + per-field Zod check above.
  const updatePayload = {
    [safeField]: parsed.data,
    updated_by: userRes.user.id,
  } as BorrowerUpdate;

  const { data: updated, error } = await supabase
    .from('borrowers')
    .update(updatePayload)
    .eq('id', borrowerId)
    .select('id');

  if (error) {
    console.error('[updateBorrowerField] db error', error);
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) {
    // 0 rows usually means RLS denied the write even though the auth-layer
    // checks above passed — surface as unauthorized rather than silent success.
    return { ok: false, error: 'unauthorized' };
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
