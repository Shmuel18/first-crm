'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { CaseFormShape } from '../schemas/case.schema';

export type UpdateCaseFeeAmountResult =
  | { ok: true }
  | {
      ok: false;
      error: 'validation' | 'unauthorized' | 'unknown';
      message?: string;
    };

/**
 * Inline patch for case_financials.fee_amount. Manager-only — the
 * upsert_case_financials RPC (migration 027) returns false silently when
 * the caller lacks `view_case_fee`, but we also fail fast at the app
 * layer for cleaner UX.
 *
 * The RPC takes BOTH fee_amount and expected_income (it overwrites the
 * whole row). We preserve the existing expected_income by reading it
 * first, then write the pair atomically. RLS on case_financials
 * (migrations 011 + 027) gates the read too.
 */
export async function updateCaseFeeAmountAction(
  caseId: string,
  rawValue: unknown,
): Promise<UpdateCaseFeeAmountResult> {
  // Reuse the same money validator the full edit form uses.
  const parsed = CaseFormShape.shape.fee_amount.safeParse(rawValue);
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return {
      ok: false,
      error: 'validation',
      message: fieldErrors.fee_amount ?? Object.values(fieldErrors)[0],
    };
  }
  const feeAmount = parsed.data ?? null;

  if (!(await userHasPermission('view_case_fee'))) {
    return { ok: false, error: 'unauthorized' };
  }

  // ISS-01 defense-in-depth: fee data is per-case, so the office-wide
  // view_case_fee permission is not enough — the caller must also be able to
  // EDIT this specific case (the RLS + RPC enforce this too since migration 200).
  if (!(await userCanEditCase(caseId))) {
    return { ok: false, error: 'unauthorized' };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return { ok: false, error: 'unauthorized' };
  }

  // Read the current expected_income so the RPC's "overwrite both"
  // semantics don't wipe it out. RLS returns null if the row doesn't
  // exist yet — that's fine, we pass null and the RPC inserts.
  const { data: current } = await supabase
    .from('case_financials')
    .select('expected_income')
    .eq('case_id', caseId)
    .maybeSingle();

  const { error } = await supabase.rpc('upsert_case_financials', {
    p_case_id: caseId,
    // The generated Supabase types mark these as non-null `number`, but the
    // RPC body accepts NULL (the columns are nullable). Same cast pattern
    // as createCaseAction.
    p_fee_amount: (feeAmount ?? null) as unknown as number,
    p_expected_income: (current?.expected_income ?? null) as unknown as number,
    p_user_id: userRes.user.id,
  });

  if (error) {
    console.error(
      '[updateCaseFeeAmount] rpc error',
      JSON.stringify({
        caseId,
        code: error.code ?? null,
        message: error.message ?? null,
      }),
    );
    return { ok: false, error: 'unknown' };
  }

  // The fee field updates optimistically client-side; defer the detail-page
  // revalidation past the response so the save returns instantly.
  after(() => revalidatePath(`/cases/${caseId}`));
  return { ok: true };
}
