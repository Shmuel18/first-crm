'use server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { safeDbError } from '@/lib/supabase/db-error-log';
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

  // Every link for this case (active + soft-deleted). The partial unique index
  // allows one ACTIVE row per bank, but soft-deleted rows can coexist — so
  // re-adding a removed bank must REACTIVATE its row, never INSERT a duplicate.
  // A duplicate (active + soft-deleted for the same bank) later breaks
  // set_primary_bank's reactivate with a 23505. See migration 102.
  const { data: caseBanks, error: lookupErr } = await supabase
    .from('case_banks')
    .select('id, bank_id, deleted_at')
    .eq('case_id', caseId);

  if (lookupErr) {
    console.error('[addCaseBank] lookup error', safeDbError(lookupErr));
    return { ok: false, error: 'unknown' };
  }

  const links = caseBanks ?? [];
  const thisBank = links.filter((r) => r.bank_id === bankId);
  if (thisBank.some((r) => r.deleted_at === null)) {
    return { ok: false, error: 'already_linked' };
  }

  // First (active) bank on the case becomes primary by default.
  const isPrimary = links.every((r) => r.deleted_at !== null);
  const fields = { is_primary: isPrimary, updated_by: userRes.user.id };

  // Reactivate a soft-deleted link for this bank if one exists; else insert.
  const softDeleted = thisBank.find((r) => r.deleted_at !== null);
  if (softDeleted) {
    const { error } = await supabase
      .from('case_banks')
      .update({ ...fields, deleted_at: null })
      .eq('id', softDeleted.id);
    if (error) {
      console.error('[addCaseBank] reactivate error', safeDbError(error));
      return { ok: false, error: 'unknown' };
    }
    return { ok: true, caseBankId: softDeleted.id };
  }

  const { data, error } = await supabase
    .from('case_banks')
    .insert({ case_id: caseId, bank_id: bankId, ...fields, created_by: userRes.user.id })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'already_linked' };
    console.error('[addCaseBank] insert error', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }

  // No revalidatePath — the inline banks list updates optimistically client-side.
  return { ok: true, caseBankId: data.id };
}
