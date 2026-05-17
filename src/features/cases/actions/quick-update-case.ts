'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

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
] as const;

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

  // Normalize empty → null
  const finalValue = value === '' ? null : value;

  // Type-narrow the update payload per field for type safety
  const updatePayload: Record<string, string | null> = {
    [field]: finalValue,
    updated_by: userRes.user.id,
  };

  const { error } = await supabase
    .from('cases')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic field whitelist already validated
    .update(updatePayload as any)
    .eq('id', caseId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/cases');
  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
