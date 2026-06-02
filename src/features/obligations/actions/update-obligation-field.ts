'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';
import { asBorrowerId, asCaseId } from '@/lib/types/branded';
import type { Database } from '@/types/database';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { ObligationFormSchema } from '../schemas/obligation.schema';
import { borrowerIsOnCase } from '@/features/borrowers/services/borrowers.service';

type ObligationUpdate = Database['public']['Tables']['borrower_obligations']['Update'];

/**
 * Whitelist of borrower_obligations columns the inline-editable row may
 * patch. `borrower_id` is excluded — the FK is set at creation and the
 * UI treats obligations as case-level (the row is billed to the primary
 * borrower from creation onward).
 */
const EDITABLE_FIELDS = [
  'lender',
  'description',
  'loan_amount',
  'monthly_payment',
  'months_remaining',
  'end_date',
] as const satisfies readonly (keyof typeof ObligationFormSchema.shape)[];

export type EditableObligationField = (typeof EDITABLE_FIELDS)[number];

export type UpdateObligationFieldResult =
  | { ok: true }
  | {
      ok: false;
      error: 'invalid_field' | 'validation' | 'unauthorized' | 'unknown';
      message?: string;
    };

export async function updateObligationFieldAction(
  obligationId: string,
  caseId: string,
  field: string,
  rawValue: unknown,
): Promise<UpdateObligationFieldResult> {
  if (!(EDITABLE_FIELDS as readonly string[]).includes(field)) {
    return { ok: false, error: 'invalid_field' };
  }
  const safeField = field as EditableObligationField;

  // Per-field Zod — same primitive the full save uses, so inline edit and
  // a future bulk edit share the same rules.
  const fieldSchema = ObligationFormSchema.shape[safeField];
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

  // Resolve the obligation's owning borrower so we can confirm the row
  // actually belongs to a borrower on THIS case (a caller with edit rights
  // on case A must not be able to patch case B's obligation via mismatched
  // ids).
  const { data: obligation } = await supabase
    .from('borrower_obligations')
    .select('borrower_id')
    .eq('id', obligationId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!obligation) return { ok: false, error: 'unauthorized' };
  if (!(await borrowerIsOnCase(asCaseId(caseId), asBorrowerId(obligation.borrower_id)))) {
    return { ok: false, error: 'unauthorized' };
  }

  const updatePayload = {
    [safeField]: parsed.data ?? null,
    updated_by: userRes.user.id,
  } as ObligationUpdate;

  const { data: updated, error } = await supabase
    .from('borrower_obligations')
    .update(updatePayload)
    .eq('id', obligationId)
    .is('deleted_at', null)
    .select('id');

  if (error) {
    console.error(
      '[updateObligationField] db error',
      JSON.stringify({ obligationId, caseId, field: safeField, ...safeDbError(error) }),
    );
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
