'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { sanitizeRichTextHtml } from '@/lib/utils/sanitize-html';

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
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.');
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
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

  const { error } = await supabase
    .from('cases')
    .update({
      ...parsed.data,
      request_details: sanitizeRichTextHtml(parsed.data.request_details ?? null),
      updated_by: userRes.user.id,
    })
    .eq('id', caseId);

  if (error) {
    return { ok: false, error: 'unknown', values };
  }

  revalidatePath('/cases');
  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}`);
}
