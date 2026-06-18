'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';

import { z } from 'zod';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { sanitizeRichTextHtml } from '@/lib/utils/sanitize-html';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { CaseFormSchema } from '../schemas/case.schema';
import type { CaseActionState } from '../types';

const CaseIdSchema = z.string().uuid();
// Version the edit form round-trips for optimistic locking (migration 056).
const CaseVersionSchema = z.coerce.number().int().nonnegative();

export async function updateCaseAction(
  _prevState: CaseActionState,
  formData: FormData,
): Promise<CaseActionState> {
  const values = formDataToValues(formData);

  const caseIdResult = CaseIdSchema.safeParse(formData.get('case_id'));
  if (!caseIdResult.success) {
    return { ok: false, error: 'validation', values };
  }
  const caseId = caseIdResult.data;

  // Optimistic-lock guard (migration 056): pin the loaded version in the
  // UPDATE WHERE so a concurrent save hits 0 rows instead of silently winning.
  const versionResult = CaseVersionSchema.safeParse(formData.get('version'));
  if (!versionResult.success) {
    return { ok: false, error: 'validation', values };
  }

  const parsed = CaseFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return { ok: false, error: 'unauthorized', values };
  }

  // Explicit case-scoped edit check (defense-in-depth; RLS would also reject).
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized', values };

  // Split financials off the cases payload (case_financials has its own
  // permission gate, view_case_fee, per migration 027).
  const { fee_amount, ...caseFields } = parsed.data;

  const { data: updatedRows, error } = await supabase
    .from('cases')
    .update({
      ...caseFields,
      request_details: sanitizeRichTextHtml(parsed.data.request_details ?? null),
      updated_by: userRes.user.id,
    })
    .eq('id', caseId)
    .eq('version', versionResult.data)
    .select('id');

  if (error) {
    // The trusted-column guard (mig 178) raises 42501 when status_id/
    // assigned_advisor_id changed without the granular permission — surface it
    // as unauthorized, not a generic error (R5-update-fee-1).
    return { ok: false, error: error.code === '42501' ? 'unauthorized' : 'unknown', values };
  }
  // 0 rows (after the edit check passed) = a concurrent writer bumped version first.
  if (!updatedRows || updatedRows.length === 0) {
    return { ok: false, error: 'conflict', values };
  }

  // Financials via RPC. Silent skip for non-admin (RPC returns false), but
  // any other failure surfaces - admin-submitted financials must not fail
  // silently (#5).
  if (fee_amount != null) {
    // Cast around the generated RPC type — see create-case.ts for the
    // same workaround: NUMERIC params accept NULL at SQL level. expected_income
    // is no longer a product field — always pass null (the column is dormant).
    const { error: finErr } = await supabase.rpc('upsert_case_financials', {
      p_case_id: caseId,
      p_fee_amount: (fee_amount ?? null) as unknown as number,
      p_expected_income: null as unknown as number,
      p_user_id: userRes.user.id,
    });
    if (finErr) {
      console.error('case_financials upsert failed', { caseId, err: finErr.message });
      return { ok: false, error: 'unknown', values };
    }
  }

  // Defer the heavy dashboard rebuild to after the response (we redirect to the
  // detail page, which we DO revalidate synchronously so it's fresh on arrival).
  after(() => revalidatePath('/cases'));
  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}`);
}
