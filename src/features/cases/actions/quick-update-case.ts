'use server';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

import { isValidTargetDate } from '../domain/target-date';
import { CaseFormShape } from '../schemas/case.schema';

type CasesUpdate = Database['public']['Tables']['cases']['Update'];

/**
 * Whitelist of fields that can be updated via inline edit.
 * Keep narrow - changes other than these go through the full form.
 */
const ALLOWED_FIELDS = [
  'status_id',
  'assigned_advisor_id',
  'short_note',
  'case_blocker',
  'insurance_status',
  'target_date',
  'referrer_name',
] as const satisfies ReadonlyArray<keyof CasesUpdate>;

type AllowedField = (typeof ALLOWED_FIELDS)[number];

type UpdateResult = { ok: true } | { ok: false; error: string };

export async function quickUpdateCaseFieldAction(
  caseId: string,
  field: AllowedField,
  value: string | null,
  expectedOld?: string | null,
): Promise<UpdateResult> {
  if (!ALLOWED_FIELDS.includes(field)) {
    return { ok: false, error: 'invalid_field' };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return { ok: false, error: 'unauthorized' };
  }

  // Defense-in-depth: caller must be able to EDIT this case (not merely see
  // it). RLS is enforced too, but this fails fast and keeps a view-only role
  // from relying on RLS alone.
  if (!(await userCanEditCase(caseId))) {
    return { ok: false, error: 'unauthorized' };
  }

  // Granular gates: these dedicated permissions (migration 002) are NOT implied
  // by generic edit, so enforce them server-side — a role with edit but without
  // these can't change status / reassign via the inline cells.
  if (field === 'status_id' && !(await userHasPermission('change_case_status'))) {
    return { ok: false, error: 'unauthorized' };
  }
  if (field === 'assigned_advisor_id' && !(await userHasPermission('assign_case_to_user'))) {
    return { ok: false, error: 'unauthorized' };
  }

  // Validate with the same per-field rule the full form uses — CaseFormShape is
  // exposed for exactly this. Bounds free text (short_note/referrer_name),
  // checks the enums (case_blocker/insurance_status) and UUIDs. Closes the
  // inline-edit validation gap (BE-2): these cells previously wrote straight to
  // the DB with no length/format check.
  const fieldSchema = CaseFormShape.shape[field];
  const parsed = fieldSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: 'validation' };
  }
  const finalValue = parsed.data ?? null;
  if (field === 'target_date' && finalValue !== null && !isValidTargetDate(finalValue)) {
    return { ok: false, error: 'validation' };
  }
  const updatePayload: CasesUpdate = {
    [field]: finalValue,
    updated_by: userRes.user.id,
  };

  // Per-field optimistic compare-and-swap (DB-2): when the caller passes the
  // value it loaded (free-text cells like the note), pin it in the WHERE so a
  // concurrent change to THIS field hits 0 rows. Other cells omit expectedOld
  // and keep last-write-wins (single value, no real data loss). No row-version
  // here → no false conflicts when a different field of the case changed.
  let query = supabase.from('cases').update(updatePayload).eq('id', caseId);
  if (expectedOld !== undefined) {
    const normExpected = expectedOld === '' ? null : expectedOld;
    query = normExpected === null ? query.is(field, null) : query.eq(field, normExpected);
  }

  // .select() confirms a row was actually updated — an RLS-denied write
  // affects 0 rows with no error, which must surface as a failure.
  const { data: updated, error } = await query.select('id');

  if (error) {
    console.error('[quickUpdateCaseField] db error', { caseId, field, code: error.code });
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) {
    // With a CAS guard, 0 rows (after the edit check passed) = a concurrent
    // writer changed this field first; without one it's an RLS denial.
    return { ok: false, error: expectedOld !== undefined ? 'conflict' : 'unauthorized' };
  }

  // Detail-page only. The dashboard relies on the inline cells' optimistic
  // state — invalidating /cases here would refetch the full 1000-row list
  // on every keystroke against a status/bank/advisor cell.
  // No revalidatePath: inline cells are optimistic, and forcing a server
  // refresh after the DB update can leave the client transition spinning while
  // the updated value is already visible from another tab. The next natural
  // navigation/refresh will read the canonical DB value.
  return { ok: true };
}
