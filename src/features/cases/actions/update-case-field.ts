'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { safeDbError } from '@/lib/supabase/db-error-log';
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

type CaseFieldErr = 'invalid_field' | 'validation' | 'unauthorized' | 'conflict' | 'unknown';
export type UpdateCaseFieldResult =
  | { ok: true }
  | { ok: false; error: CaseFieldErr; message?: string };

export async function updateCaseFieldAction(
  caseId: string,
  field: string,
  rawValue: unknown,
  expectedOld?: string | null,
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

  // Granular gates (mirror quickUpdateCaseFieldAction): the dedicated keys are
  // NOT implied by generic edit. The DB trigger (mig 178) is the hard guarantee
  // on every path; this fails fast with a clean error (R5-update-fee-1).
  if (safeField === 'status_id' && !(await userHasPermission('change_case_status'))) {
    return { ok: false, error: 'unauthorized' };
  }
  if (safeField === 'assigned_advisor_id' && !(await userHasPermission('assign_case_to_user'))) {
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

  // Per-field optimistic compare-and-swap (DB-2) for the free-text inline
  // editor (request_details): when the caller passes the value it loaded, a
  // concurrent change to that field makes this match 0 rows → 'conflict'.
  let query = supabase.from('cases').update(patch).eq('id', caseId).is('deleted_at', null);
  if (expectedOld !== undefined) {
    const { data: current, error: currentError } = await supabase
      .from('cases')
      .select(safeField)
      .eq('id', caseId)
      .is('deleted_at', null)
      .maybeSingle();

    if (currentError) {
      console.error(
        '[updateCaseField] current read error',
        JSON.stringify({ caseId, field: safeField, ...safeDbError(currentError) }),
      );
      return { ok: false, error: 'unknown' };
    }
    if (!current) {
      return { ok: false, error: 'unauthorized' };
    }

    const currentValue = current[safeField as keyof typeof current];
    if (
      normalizeComparableValue(safeField, currentValue) !==
      normalizeComparableValue(safeField, expectedOld)
    ) {
      return { ok: false, error: 'conflict' };
    }

    query =
      currentValue == null
        ? query.is(safeField, null)
        : query.eq(safeField, currentValue as never);
  }
  const { data: updated, error } = await query.select('id');

  if (error) {
    // Flat JSON so the Supabase error props survive serialization (matches
    // updateBorrowerFieldAction's logging shape).
    console.error(
      '[updateCaseField] update error',
      JSON.stringify({ caseId, field: safeField, ...safeDbError(error) }),
    );
    return { ok: false, error: 'unknown' };
  }
  // CAS guard: 0 rows with a pinned old value = a concurrent writer changed it.
  if (expectedOld !== undefined && (!updated || updated.length === 0)) {
    return { ok: false, error: 'conflict' };
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}

// Defense-in-depth HTML sanitization for rich-text columns. All other
// fields pass through unchanged.
function maybeSanitize(field: EditableCaseField, parsed: unknown): unknown {
  if (field !== 'request_details') return parsed ?? null;
  return normalizeComparableValue(field, parsed);
}

function normalizeComparableValue(field: EditableCaseField, value: unknown): string | null {
  if (value == null || value === '') return null;

  const stringValue = String(value);
  if (field !== 'request_details') return stringValue;

  const sanitized = sanitizeRichTextHtml(stringValue).trim();
  return sanitized === '' || sanitized === '<p></p>' ? null : sanitized;
}
