'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { sanitizeRichTextHtml } from '@/lib/utils/sanitize-html';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { CaseFormSchema } from '../schemas/case.schema';
import type { CaseActionState, CaseFormValues } from '../types';

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

  // Split financials off the cases payload - they live in case_financials
  // (admin-only RLS). Non-admin submits with empty values, which we silently
  // drop here; RLS would also reject the case_financials write.
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

  if (fee_amount != null || expected_income != null) {
    const { error: finErr } = await supabase
      .from('case_financials')
      .insert({
        case_id: data.id,
        fee_amount: fee_amount ?? null,
        expected_income: expected_income ?? null,
        created_by: userRes.user.id,
        updated_by: userRes.user.id,
      });
    // Non-admin attempts hit RLS - we don't fail the whole create for that.
    if (finErr) console.warn('case_financials insert skipped', { caseId: data.id, err: finErr.message });
  }

  revalidatePath('/cases');
  redirect(`/cases/${data.id}`);
}
