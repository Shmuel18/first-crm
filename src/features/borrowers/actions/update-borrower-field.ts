'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { asBorrowerId, asCaseId } from '@/lib/types/branded';
import type { Database } from '@/types/database';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { BorrowerFormSchema } from '../schemas/borrower.schema';

type BorrowerUpdate = Database['public']['Tables']['borrowers']['Update'];

/**
 * Whitelist of borrower-table columns the inline-editable card is allowed to
 * patch. Junction fields (role_in_case, is_primary) live on case_borrowers
 * and have their own action — they're intentionally NOT in this list.
 *
 * The whitelist exists for two reasons:
 *   - Defense-in-depth against a manipulated client request asking us to
 *     update id / created_by / deleted_at.
 *   - It lets us pick the right per-field Zod schema by name without
 *     evaluating user-provided strings as code.
 */
const EDITABLE_FIELDS = [
  'first_name',
  'last_name',
  'national_id',
  'id_issue_date',
  'id_expiry_date',
  'gender',
  'phone',
  'landline_phone',
  'email',
  'preferred_language',
  'birth_date',
  'marital_status',
  'children_count',
  'relationship_in_case',
  'address',
  'city',
  'citizenship',
  'additional_citizenships',
  'residency_type',
  'employment_status',
  'employer_name',
  'credit_rating',
  'owns_other_property',
  'related_to_sellers',
  'notes',
] as const satisfies readonly (keyof typeof BorrowerFormSchema.shape)[];

export type EditableBorrowerField = (typeof EDITABLE_FIELDS)[number];

export type UpdateBorrowerFieldResult =
  | { ok: true }
  | { ok: false; error: 'invalid_field' | 'validation' | 'unauthorized' | 'unknown'; message?: string };

async function borrowerIsOnCase(caseId: string, borrowerId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('case_borrowers')
    .select('borrower_id')
    .eq('case_id', caseId)
    .eq('borrower_id', borrowerId)
    .maybeSingle();
  return data !== null;
}

/**
 * Update a single borrower field. Validates the value with the same Zod
 * primitive the full form uses, so an inline edit and a full-form save share
 * one rule set.
 */
export async function updateBorrowerFieldAction(
  borrowerId: string,
  caseId: string,
  field: string,
  rawValue: unknown,
): Promise<UpdateBorrowerFieldResult> {
  // Field name must be on the whitelist — never trust the client.
  if (!(EDITABLE_FIELDS as readonly string[]).includes(field)) {
    return { ok: false, error: 'invalid_field' };
  }
  const safeField = field as EditableBorrowerField;

  // Run only the per-field validator. `safeParse` on the slice rather than the
  // whole schema avoids spurious "required" errors on the other 20 fields.
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

  if (error) return { ok: false, error: 'unknown', message: error.message };
  if (!updated || updated.length === 0) {
    // 0 rows usually means RLS denied the write even though the auth-layer
    // checks above passed — surface as unauthorized rather than silent success.
    return { ok: false, error: 'unauthorized' };
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
