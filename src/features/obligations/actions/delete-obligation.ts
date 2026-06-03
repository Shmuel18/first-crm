'use server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { asBorrowerId, asCaseId } from '@/lib/types/branded';

import { borrowerIsOnCase } from '@/features/borrowers/services/borrowers.service';

type DeleteResult = { ok: true } | { ok: false; error: 'unauthorized' | 'unknown' };

export async function deleteObligationAction(
  obligationId: string,
  borrowerId: string,
  caseId: string,
): Promise<DeleteResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };
  if (!(await borrowerIsOnCase(asCaseId(caseId), asBorrowerId(borrowerId)))) {
    return { ok: false, error: 'unauthorized' };
  }

  const { data: deleted, error } = await supabase.rpc('soft_delete_borrower_obligation', {
    p_case_id: caseId,
    p_obligation_id: obligationId,
  });

  if (error) {
    console.error(
      '[deleteObligation] rpc error',
      JSON.stringify({
        obligationId,
        borrowerId,
        caseId,
        code: error.code ?? null,
        message: error.message ?? null,
      }),
    );
    return { ok: false, error: 'unknown' };
  }
  if (deleted !== true) return { ok: false, error: 'unauthorized' };

  // No revalidatePath — the client removes the row + recomputes the total
  // optimistically (FE-1), avoiding a full case-page re-render.
  return { ok: true };
}
