'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';

import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { sanitizeRichTextHtml } from '@/lib/utils/sanitize-html';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { CaseFormSchema } from '../schemas/case.schema';
import type { CaseActionState } from '../types';

export async function createCaseAction(
  _prevState: CaseActionState,
  formData: FormData,
): Promise<CaseActionState> {
  const values = formDataToValues(formData);
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

  // Defense-in-depth: explicit permission check before any DB work. RLS
  // would also block, but failing fast here gives a clean unauthorized
  // response instead of an opaque 'unknown' from the eventual RLS reject.
  if (!(await userHasPermission('create_case'))) {
    return { ok: false, error: 'unauthorized', values };
  }

  // Split financials off the cases payload (case_financials has its own
  // permission gate, view_case_fee, per migration 027).
  const { fee_amount, expected_income, ...caseFields } = parsed.data;

  const { data, error } = await supabase
    .from('cases')
    .insert({
      ...caseFields,
      request_details: sanitizeRichTextHtml(parsed.data.request_details ?? null),
      created_by: userRes.user.id,
      updated_by: userRes.user.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: 'unknown', values };
  }

  // Financials via the upsert_case_financials RPC (migration 027). The RPC
  // returns false silently when the caller lacks view_case_fee (the form
  // hides fields for non-admins; ignored values aren't an error). Any other
  // failure is a real bug that MUST surface - finance data can't fail quietly.
  if (fee_amount != null || expected_income != null) {
    // The generated RPC type declares p_fee_amount/p_expected_income as
    // non-null `number`, but the underlying NUMERIC params accept NULL at
    // the SQL level (case_financials.fee_amount / expected_income are
    // nullable columns). Cast through unknown so callers can pass null
    // without lying about the value being a number.
    const { error: finErr } = await supabase.rpc('upsert_case_financials', {
      p_case_id: data.id,
      p_fee_amount: (fee_amount ?? null) as unknown as number,
      p_expected_income: (expected_income ?? null) as unknown as number,
      p_user_id: userRes.user.id,
    });
    if (finErr) {
      console.error('case_financials upsert failed', { caseId: data.id, err: finErr.message });
      // The cases row already committed (separate request). Remove the orphan so
      // the user's retry creates ONE clean case instead of a duplicate (DB-3).
      // Guarded + best-effort: delete_failed_case (migration 119) only removes a
      // just-created, borrower-less, financials-less case owned by the caller.
      const { error: cleanupErr } = await (
        supabase as unknown as {
          rpc: (
            fn: 'delete_failed_case',
            args: { p_case_id: string },
          ) => Promise<{ error: { message: string } | null }>;
        }
      ).rpc('delete_failed_case', { p_case_id: data.id });
      if (cleanupErr) {
        console.error('orphan-case cleanup failed', { caseId: data.id, err: cleanupErr.message });
      }
      return { ok: false, error: 'unknown', values };
    }
  }

  // Defer the heavy dashboard rebuild (listCases + bootstrap RPC over the whole
  // portfolio) to after the response — we redirect to the detail page, so the
  // dashboard only needs to be fresh on the user's NEXT visit. Keeps the save
  // spinner from blocking 0.5-2s on the full-portfolio revalidation.
  after(() => revalidatePath('/cases'));
  redirect(`/cases/${data.id}`);
}
