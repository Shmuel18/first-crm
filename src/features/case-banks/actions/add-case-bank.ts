'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true; caseBankId: string }
  | { ok: false; error: 'unauthorized' | 'already_linked' | 'unknown' };

/**
 * Inserts a case_banks row linking `bankId` to `caseId`. Auto-promotes to
 * primary if the case has no existing primary bank (mirrors the borrowers
 * auto-promote-first pattern in addEmptyBorrowerAction).
 *
 * Backs the "+ הוסף בנק" picker on the admin block: user picks a bank
 * from the available list → action fires → row appears in the list.
 */
export async function addCaseBankAction(
  caseId: string,
  bankId: string,
): Promise<Result> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  if (!(await userCanEditCase(caseId))) {
    return { ok: false, error: 'unauthorized' };
  }

  // First (active) bank on the case becomes primary by default. The
  // ensure_single_primary_bank trigger (migration 006) is a no-op when no
  // other row claims primary, so it's safe to set is_primary here.
  const { count: existingCount, error: countErr } = await supabase
    .from('case_banks')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseId)
    .is('deleted_at', null);

  if (countErr) {
    console.error('[addCaseBank] count error', countErr);
    return { ok: false, error: 'unknown' };
  }
  const isPrimary = (existingCount ?? 0) === 0;

  const { data, error } = await supabase
    .from('case_banks')
    .insert({
      case_id: caseId,
      bank_id: bankId,
      is_primary: isPrimary,
      created_by: userRes.user.id,
      updated_by: userRes.user.id,
    })
    .select('id')
    .single();

  if (error) {
    // 23505 = unique_violation — case_banks has UNIQUE(case_id, bank_id),
    // so this fires when the user picks a bank already linked to the case.
    if (error.code === '23505') {
      return { ok: false, error: 'already_linked' };
    }
    console.error('[addCaseBank] insert error', error);
    return { ok: false, error: 'unknown' };
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true, caseBankId: data.id };
}
