'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRichTextHtml } from '@/lib/utils/sanitize-html';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';
import type { Database } from '@/types/database';

import {
  isEditableCaseField,
  type EditableCaseField,
} from '../domain/editable-case-fields';
import { CaseFormShape } from '../schemas/case.schema';

type CaseUpdate = Database['public']['Tables']['cases']['Update'];

/**
 * Patch a single case-level column for inline-edit controls. Per-field Zod
 * via CaseFormShape.shape[field] keeps inline + full-form rules aligned.
 * EDITABLE_CASE_FIELDS whitelists writable columns (junction fields have
 * dedicated actions). Mirrors updateBorrowerFieldAction's contract.
 */

type CaseFieldErr = 'invalid_field' | 'validation' | 'unauthorized' | 'unknown';
export type UpdateCaseFieldResult =
  | { ok: true }
  | { ok: false; error: CaseFieldErr; message?: string };

export async function updateCaseFieldAction(
  caseId: string,
  field: string,
  rawValue: unknown,
): Promise<UpdateCaseFieldResult> {
  if (!isEditableCaseField(field)) {
    return { ok: false, error: 'invalid_field' };
  }
  const safeField: EditableCaseField = field;

  // Slice the form schema down to the single editable field.
  const fieldSchema = CaseFormShape.shape[safeField];
  const parsed = fieldSchema.safeParse(rawValue);
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    const message = fieldErrors[safeField] ?? Object.values(fieldErrors)[0];
    return { ok: false, error: 'validation', message };
  }

  if (!(await userCanEditCase(caseId))) {
    return { ok: false, error: 'unauthorized' };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return { ok: false, error: 'unauthorized' };
  }

  // safeField comes from the whitelist, so the indexed key cast is sound.
  const patch = {
    [safeField]: maybeSanitize(safeField, parsed.data),
    updated_by: userRes.user.id,
  } as CaseUpdate;

  const { error } = await supabase
    .from('cases')
    .update(patch)
    .eq('id', caseId)
    .is('deleted_at', null);

  if (error) {
    // Flat JSON so the Supabase error props survive serialization (matches
    // updateBorrowerFieldAction's logging shape).
    console.error(
      '[updateCaseField] update error',
      JSON.stringify({
        caseId,
        field: safeField,
        code: error.code ?? null,
        message: error.message ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
      }),
    );
    return { ok: false, error: 'unknown' };
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}

// Defense-in-depth HTML sanitization for rich-text columns. All other
// fields pass through unchanged.
function maybeSanitize(field: EditableCaseField, parsed: unknown): unknown {
  if (field !== 'request_details') return parsed ?? null;
  return sanitizeRichTextHtml(typeof parsed === 'string' ? parsed : null);
}
