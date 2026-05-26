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
 * Update a single borrower field. Validates the value with the same Zod
 * primitive the full form uses, so an inline edit and a full-form save
 * share one rule set.
 *
 * Writes route through update_borrower_in_case (migration 064) so the
 * per-case scope check (the borrower must be on THIS case) runs at the
 * DB layer too — a borrower shared across cases can't be mutated by a
 * party that only owns one of those cases.
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
  // The borrowerIsOnCase check guards against a malformed (caseId, borrowerId)
  // pair; the RPC re-verifies the same invariant defensively.
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };
  if (!(await borrowerIsOnCase(asCaseId(caseId), asBorrowerId(borrowerId)))) {
    return { ok: false, error: 'unauthorized' };
  }

  // RPC accepts a JSONB patch keyed by column name. The per-field validator
  // above guarantees the value type matches the column (Zod schema is the
  // single source of truth), and the RPC strips server-controlled columns
  // (id/created_*/updated_*/deleted_at/metadata) defensively.
  const patch = { [safeField]: parsed.data ?? null };

  const { data: rowsUpdated, error } = await supabase.rpc('update_borrower_in_case', {
    p_case_id: caseId,
    p_borrower_id: borrowerId,
    p_patch: patch,
  });

  if (error) {
    console.error('[updateBorrowerField] rpc error', error);
    // Postgres 42501 maps to RLS / explicit RAISE EXCEPTION 'not authorized'
    // from the RPC's scope checks. Surface as unauthorized rather than unknown.
    if (error.code === '42501') return { ok: false, error: 'unauthorized' };
    return { ok: false, error: 'unknown' };
  }
  if (rowsUpdated !== true) {
    // RPC returns FALSE when the patch had nothing to apply (e.g. the only
    // key was a stripped server-controlled column) — treat as a no-op, not
    // a failure, but surface as unauthorized for safety since the UI's
    // intended write didn't take effect.
    return { ok: false, error: 'unauthorized' };
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
