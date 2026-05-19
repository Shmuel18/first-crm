'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { z } from 'zod';

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

  // Defense-in-depth: caller must be able to see the case before mutating
  const { data: caseRow } = await supabase
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .maybeSingle();
  if (!caseRow) return { ok: false, error: 'unauthorized', values };

  // Split financials off the cases payload (case_financials is admin-only).
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

  // Upsert into case_financials. RLS gates this to admins; a non-admin
  // submitting an edit form (where the fields are hidden) sends them as
  // null/empty which we silently skip here. Real admins succeed.
  if (fee_amount != null || expected_income != null) {
    const { error: finErr } = await supabase
      .from('case_financials')
      .upsert(
        {
          case_id: caseId,
          fee_amount: fee_amount ?? null,
          expected_income: expected_income ?? null,
          updated_by: userRes.user.id,
        },
        { onConflict: 'case_id' },
      );
    if (finErr) console.warn('case_financials upsert skipped', { caseId, err: finErr.message });
  }

  revalidatePath('/cases');
  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}`);
}
