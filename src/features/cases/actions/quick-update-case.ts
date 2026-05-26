'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

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
  'referrer_name',
] as const satisfies ReadonlyArray<keyof CasesUpdate>;

type AllowedField = (typeof ALLOWED_FIELDS)[number];

type UpdateResult = { ok: true } | { ok: false; error: string };

export async function quickUpdateCaseFieldAction(
  caseId: string,
  field: AllowedField,
  value: string | null,
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

  const finalValue = value === '' ? null : value;
  const updatePayload: CasesUpdate = {
    [field]: finalValue,
    updated_by: userRes.user.id,
  };

  // .select() confirms a row was actually updated — an RLS-denied write
  // affects 0 rows with no error, which must surface as a failure.
  const { data: updated, error } = await supabase
    .from('cases')
    .update(updatePayload)
    .eq('id', caseId)
    .select('id');

  if (error) {
    console.error('[quickUpdateCaseField] db error', { caseId, field, code: error.code });
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) {
    return { ok: false, error: 'unauthorized' };
  }

  // Detail-page only. The dashboard relies on the inline cells' optimistic
  // state — invalidating /cases here would refetch the full 1000-row list
  // on every keystroke against a status/bank/advisor cell.
  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
