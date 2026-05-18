'use server';

import { revalidatePath } from 'next/cache';

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

  // Defense-in-depth: confirm caller can actually see this case before
  // mutating - RLS is enforced too, but a permission regression in a
  // future migration shouldn't silently let this action through.
  const { data: caseRow } = await supabase
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .maybeSingle();
  if (!caseRow) {
    return { ok: false, error: 'unauthorized' };
  }

  const finalValue = value === '' ? null : value;
  const updatePayload: CasesUpdate = {
    [field]: finalValue,
    updated_by: userRes.user.id,
  };

  const { error } = await supabase
    .from('cases')
    .update(updatePayload)
    .eq('id', caseId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/cases');
  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
