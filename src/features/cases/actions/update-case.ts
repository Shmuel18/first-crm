'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { z } from 'zod';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { sanitizeRichTextHtml } from '@/lib/utils/sanitize-html';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { CaseFormSchema } from '../schemas/case.schema';
import type { CaseActionState, CaseFormValues } from '../types';

const CaseIdSchema = z.string().uuid();

function formDataToObject(fd: FormData): Record<string, FormDataEntryValue> {
  const obj: Record<string, FormDataEntryValue> = {};
  fd.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

function formDataToValues(fd: FormData): CaseFormValues {
  const out: CaseFormValues = {};
  fd.forEach((value, key) => {
    if (typeof value === 'string') out[key] = value;
  });
  return out;
}

export async function updateCaseAction(
  _prevState: CaseActionState,
  formData: FormData,
): Promise<CaseActionState> {
  const values = formDataToValues(formData);
  const rawCaseId = formData.get('case_id');
  const caseIdResult = CaseIdSchema.safeParse(rawCaseId);
  if (!caseIdResult.success) {
    return { ok: false, error: 'validation', values };
  }
  const caseId = caseIdResult.data;

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
  const { fee_amount, expected_income, ...caseFields } = parsed.data;

  const { error } = await supabase
    .from('cases')
    .update({
      ...caseFields,
      request_details: sanitizeRichTextHtml(parsed.data.request_details ?? null),
      updated_by: userRes.user.id,
    })
    .eq('id', caseId);

  if (error) {
    return { ok: false, error: 'unknown', values };
  }

  // Financials via RPC. Silent skip for non-admin (RPC returns false), but
  // any other failure surfaces - admin-submitted financials must not fail
  // silently (#5).
  if (fee_amount != null || expected_income != null) {
    // Cast around the generated RPC type — see create-case.ts for the
    // same workaround: NUMERIC params accept NULL at SQL level.
    const { error: finErr } = await supabase.rpc('upsert_case_financials', {
      p_case_id: caseId,
      p_fee_amount: (fee_amount ?? null) as unknown as number,
      p_expected_income: (expected_income ?? null) as unknown as number,
      p_user_id: userRes.user.id,
    });
    if (finErr) {
      console.error('case_financials upsert failed', { caseId, err: finErr.message });
      return { ok: false, error: 'unknown', values };
    }
  }

  revalidatePath('/cases');
  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}`);
}
