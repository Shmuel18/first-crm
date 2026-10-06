'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import type { CaseFeeTerms } from '../domain/fee-terms';
import { CaseFeeTermsSchema } from '../schemas/case-fee.schema';

export type SetCaseFeeTermsResult =
  | { ok: true; terms: CaseFeeTerms }
  | {
      ok: false;
      error: 'validation' | 'unauthorized' | 'unknown';
      message?: string;
    };

/**
 * Inline write of the agreed fee in מנהלה — a fixed sum OR a percentage of the
 * requested loan (migration 248). Manager-only: view_case_fee plus edit rights
 * on THIS case (ISS-01); the set_case_fee_terms RPC and the case_financials RLS
 * enforce both too. Returns the stored terms, because for a percentage the
 * database derives the shekel sum from the loan and the field shows it.
 */
export async function setCaseFeeTermsAction(
  caseId: string,
  input: unknown,
): Promise<SetCaseFeeTermsResult> {
  const parsed = CaseFeeTermsSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', message: Object.values(fieldErrors)[0] };
  }

  if (!(await userHasPermission('view_case_fee'))) {
    return { ok: false, error: 'unauthorized' };
  }
  if (!(await userCanEditCase(caseId))) {
    return { ok: false, error: 'unauthorized' };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return { ok: false, error: 'unauthorized' };
  }

  const { basis, value } = parsed.data;
  const percent = basis === 'percent' ? value : null;
  const { data, error } = await supabase.rpc('set_case_fee_terms', {
    p_case_id: caseId,
    // The generated types mark NUMERIC args non-null, but NULL is the point
    // here: it means "not this basis" (or a cleared fee). Same cast pattern as
    // the other case_financials RPC calls (createCaseAction).
    p_fee_amount: (basis === 'fixed' ? value : null) as unknown as number,
    p_fee_percent: percent as unknown as number,
    p_user_id: userRes.user.id,
  });

  if (error) {
    console.error(
      '[setCaseFeeTerms] rpc error',
      JSON.stringify({ caseId, code: error.code ?? null, message: error.message ?? null }),
    );
    return { ok: false, error: 'unknown' };
  }

  // The field updates in place; defer the detail-page revalidation past the
  // response so the save returns instantly.
  after(() => revalidatePath(`/cases/${caseId}`));
  return { ok: true, terms: { amount: data ?? null, percent } };
}
