'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

export type RemoveBorrowerFromCaseResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'primary' | 'last' | 'not_found' | 'unknown' };

/**
 * Detach a borrower from a case by deleting the `case_borrowers` junction
 * row. The borrower entity itself stays — they may live on other cases.
 *
 * Refuses to remove the primary borrower: a case without a primary is a
 * data-integrity hole (the cases.primary_borrower_id column expects one),
 * and forcing the user to promote a different borrower first makes the
 * intent explicit. The card hides this action's button for primaries
 * anyway; the server-side check guards against a stale UI / direct call.
 */
export async function removeBorrowerFromCaseAction(
  caseId: string,
  borrowerId: string,
): Promise<RemoveBorrowerFromCaseResult> {
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();

  // Verify the link exists and isn't the primary. One round-trip — the
  // subsequent DELETE filters on the same predicate so there's no race
  // between the check and the delete.
  const { data: link, error: lookupErr } = await supabase
    .from('case_borrowers')
    .select('is_primary')
    .eq('case_id', caseId)
    .eq('borrower_id', borrowerId)
    .maybeSingle();

  if (lookupErr) {
    console.error('[removeBorrowerFromCase] lookup failed', {
      caseId,
      borrowerId,
      code: lookupErr.code,
    });
    return { ok: false, error: 'unknown' };
  }
  if (!link) return { ok: false, error: 'not_found' };
  if (link.is_primary) return { ok: false, error: 'primary' };

  // A case needs at least one borrower. If this row is the only link, reject
  // — the UI hides the button in this state too, but a stale page or a direct
  // call could still try.
  const { count: total } = await supabase
    .from('case_borrowers')
    .select('borrower_id', { count: 'exact', head: true })
    .eq('case_id', caseId);
  if ((total ?? 0) <= 1) return { ok: false, error: 'last' };

  const { error: deleteErr, count } = await supabase
    .from('case_borrowers')
    .delete({ count: 'exact' })
    .eq('case_id', caseId)
    .eq('borrower_id', borrowerId)
    .eq('is_primary', false);

  if (deleteErr) {
    console.error('[removeBorrowerFromCase] delete failed', {
      caseId,
      borrowerId,
      code: deleteErr.code,
    });
    return { ok: false, error: 'unknown' };
  }
  if (count === 0) return { ok: false, error: 'not_found' };

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
