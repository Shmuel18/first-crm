'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

/**
 * Adds an empty borrower row + links it to the case. Used by the inline
 * "+ הוסף לווה" button on the live case-detail page: click → new empty
 * card appears at the bottom of the borrowers list, ready for inline
 * editing via the existing CaseBorrowerCard machinery.
 *
 * This replaces the old multi-step flow of navigating to
 * /cases/[id]/borrowers/new and submitting a full form. The full form
 * is still reachable for the rare case the user wants to enter every
 * field up front, but the inline path matches the office's actual
 * workflow ("got a phone call — let me jot down a name").
 *
 * Returns Result. Failures: missing auth, lacks edit_own/edit_any permission,
 * or DB error. No raw Supabase messages bubble out — the UI maps codes
 * to translated strings.
 */
export type AddEmptyBorrowerResult =
  | { ok: true; borrowerId: string }
  | { ok: false; error: 'unauthorized' | 'unknown' };

export async function addEmptyBorrowerAction(
  caseId: string,
): Promise<AddEmptyBorrowerResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return { ok: false, error: 'unauthorized' };
  }

  if (!(await userCanEditCase(caseId))) {
    return { ok: false, error: 'unauthorized' };
  }

  // Insert an empty borrower. All fields nullable at the DB level
  // (migration 007 + the progressive-validation principle), so we just stamp
  // created_by/updated_by and let the user fill the rest inline.
  const { data: borrower, error: borrowerErr } = await supabase
    .from('borrowers')
    .insert({
      created_by: userRes.user.id,
      updated_by: userRes.user.id,
    })
    .select('id')
    .single();

  if (borrowerErr || !borrower) {
    console.error('[addEmptyBorrower] borrower insert failed', {
      caseId,
      err: borrowerErr?.message,
    });
    return { ok: false, error: 'unknown' };
  }

  // Determine is_primary: first borrower on the case becomes primary.
  // The partial UNIQUE index uq_case_borrowers_one_primary (migration 024)
  // enforces "at most one primary per case", so race-safe to set here.
  const { count: existingCount } = await supabase
    .from('case_borrowers')
    .select('borrower_id', { count: 'exact', head: true })
    .eq('case_id', caseId);

  const isPrimary = (existingCount ?? 0) === 0;

  const { error: linkErr } = await supabase
    .from('case_borrowers')
    .insert({
      case_id: caseId,
      borrower_id: borrower.id,
      role_in_case: 'borrower',
      is_primary: isPrimary,
    });

  if (linkErr) {
    console.error('[addEmptyBorrower] case_borrowers insert failed', {
      caseId,
      borrowerId: borrower.id,
      err: linkErr.message,
    });
    // Best-effort rollback of the orphan borrower row. If this fails too,
    // it gets cleaned up by the periodic orphan-cleanup job (the borrower
    // has no case_borrowers link so it's unreachable from any case view).
    await supabase.from('borrowers').delete().eq('id', borrower.id);
    return { ok: false, error: 'unknown' };
  }

  // Mirror primary_borrower_id on the case row when we just promoted the
  // first borrower (matches save_borrower_for_case behaviour).
  if (isPrimary) {
    await supabase
      .from('cases')
      .update({ primary_borrower_id: borrower.id, updated_by: userRes.user.id })
      .eq('id', caseId);
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true, borrowerId: borrower.id };
}
