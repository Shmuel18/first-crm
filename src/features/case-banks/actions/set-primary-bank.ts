'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: string };

/**
 * Quick action: sets the primary bank for a case from the dashboard.
 * If the bank already exists in case_banks → marks it primary (unsets others).
 * If the bank doesn't exist yet → creates a new case_banks row with is_primary=true.
 *
 * This is for the dashboard quick-edit. Full bank details (banker, status, dates)
 * are edited via /cases/[id]/banks/[bankId]/edit.
 */
export async function setPrimaryBankAction(
  caseId: string,
  bankId: string | null,
): Promise<Result> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return { ok: false, error: 'unauthorized' };
  }

  // 1. Unset is_primary on all existing case_banks for this case
  const { error: unsetError } = await supabase
    .from('case_banks')
    .update({ is_primary: false })
    .eq('case_id', caseId)
    .eq('is_primary', true);

  if (unsetError) return { ok: false, error: unsetError.message };

  if (bankId === null) {
    // Just clearing the primary - we're done
    revalidatePath('/cases');
    revalidatePath(`/cases/${caseId}`);
    return { ok: true };
  }

  // 2. Check if this case_bank already exists
  const { data: existing } = await supabase
    .from('case_banks')
    .select('id')
    .eq('case_id', caseId)
    .eq('bank_id', bankId)
    .maybeSingle();

  if (existing) {
    // Update existing row to primary
    const { error: updateError } = await supabase
      .from('case_banks')
      .update({ is_primary: true })
      .eq('id', existing.id);

    if (updateError) return { ok: false, error: updateError.message };
  } else {
    // Insert new row as primary
    const { error: insertError } = await supabase.from('case_banks').insert({
      case_id: caseId,
      bank_id: bankId,
      is_primary: true,
      created_by: userRes.user.id,
      updated_by: userRes.user.id,
    });

    if (insertError) return { ok: false, error: insertError.message };
  }

  revalidatePath('/cases');
  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
