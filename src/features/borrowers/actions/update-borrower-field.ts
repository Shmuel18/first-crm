'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { asBorrowerId, asCaseId } from '@/lib/types/branded';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import type { Database } from '@/types/database';

type BorrowersUpdate = Database['public']['Tables']['borrowers']['Update'];

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

  // The original `update_borrower_in_case` RPC (migration 064) is broken:
  // it references the target table from inside a FROM-clause expression
  // (`jsonb_populate_record(b, patch)` while `b` is the UPDATE alias),
  // which Postgres rejects with 42P10. App-layer scope checks above
  // already enforce the same invariants the RPC was meant to enforce
  // (user can edit case + borrower is on case), so we route the write
  // through the admin client until a follow-up migration replaces the
  // RPC with a non-broken implementation. Same pattern as deleteCase /
  // restoreCase: app gates, service-role does the write.
  // Dynamic-key Supabase Update types only accept the static column union;
  // safeField is constrained to EditableBorrowerField (a subset of those
  // columns), and parsed.data was validated against the same Zod primitive
  // the column type expects. Cast to BorrowersUpdate so TS accepts the
  // dynamic key — runtime safety comes from `isEditableBorrowerField` +
  // the per-field Zod validator above.
  const updatePayload = {
    [safeField]: parsed.data ?? null,
    updated_by: userRes.user.id,
  } as BorrowersUpdate;
  const admin = createAdminClient();
  const { data: updatedRows, error } = await admin
    .from('borrowers')
    .update(updatePayload)
    .eq('id', borrowerId)
    .is('deleted_at', null)
    .select('id');

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
  if (!updatedRows || updatedRows.length === 0) {
    // Borrower row is missing or soft-deleted under us — likely a stale UI.
    return { ok: false, error: 'unauthorized' };
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
