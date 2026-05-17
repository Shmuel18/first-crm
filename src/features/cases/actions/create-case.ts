'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

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

  const { data, error } = await supabase
    .from('cases')
    .insert({
      ...parsed.data,
      created_by: userRes.user.id,
      updated_by: userRes.user.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: 'unknown', values };
  }

  revalidatePath('/cases');
  redirect(`/cases/${data.id}`);
}
