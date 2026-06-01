'use server';

import { z } from 'zod';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { asBorrowerId, asCaseId } from '@/lib/types/branded';

import { ROLE_IN_CASE_VALUES } from '../schemas/borrower.schema';
import { borrowerIsOnCase } from '../services/borrowers.service';

const RoleSchema = z.enum(ROLE_IN_CASE_VALUES, { error: 'common.errors.invalidEnum' });

export type UpdateBorrowerRoleResult =
  | { ok: true }
  | { ok: false; error: 'validation' | 'unauthorized' | 'unknown'; message?: string };

/**
 * Update a borrower's role on a case (case_borrowers.role_in_case). Unlike the
 * borrower-table fields this lives on the junction row, so it writes there
 * directly — the case_borrowers_update RLS policy (migration 024) is the real
 * gate, with the auth checks below as defense-in-depth.
 *
 * No revalidatePath: the card mutates optimistically and a revalidate on the
 * heavy /cases/[id] route causes a scroll-jump + full re-render.
 */
export async function updateBorrowerRoleAction(
  caseId: string,
  borrowerId: string,
  rawRole: unknown,
): Promise<UpdateBorrowerRoleResult> {
  const parsed = RoleSchema.safeParse(rawRole);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };
  if (!(await borrowerIsOnCase(asCaseId(caseId), asBorrowerId(borrowerId)))) {
    return { ok: false, error: 'unauthorized' };
  }

  const { data: updated, error } = await supabase
    .from('case_borrowers')
    .update({ role_in_case: parsed.data })
    .eq('case_id', caseId)
    .eq('borrower_id', borrowerId)
    .select('borrower_id');

  if (error) {
    console.error(
      '[updateBorrowerRole] update error',
      JSON.stringify({
        caseId,
        borrowerId,
        code: error.code ?? null,
        message: error.message ?? null,
      }),
    );
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) {
    return { ok: false, error: 'unauthorized' };
  }

  return { ok: true };
}
