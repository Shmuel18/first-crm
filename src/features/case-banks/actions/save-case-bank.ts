'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { CaseBankFormSchema } from '../schemas/case-bank.schema';
import type { CaseBankActionState } from '../types';

function formDataToObject(fd: FormData): Record<string, FormDataEntryValue> {
  const obj: Record<string, FormDataEntryValue> = {};
  fd.forEach((v, k) => {
    obj[k] = v;
  });
  return obj;
}

function formDataToValues(fd: FormData): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  fd.forEach((v, k) => {
    if (typeof v === 'string') out[k] = v;
  });
  return out;
}

export async function saveCaseBankAction(
  _prevState: CaseBankActionState,
  formData: FormData,
): Promise<CaseBankActionState> {
  const values = formDataToValues(formData);
  const caseId = formData.get('case_id');
  const caseBankId = formData.get('case_bank_id'); // empty for create, uuid for edit

  if (typeof caseId !== 'string' || !caseId) {
    return { ok: false, error: 'validation', values };
  }

  const parsed = CaseBankFormSchema.safeParse(formDataToObject(formData));
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

  const payload = {
    case_id: caseId,
    ...parsed.data,
    updated_by: userRes.user.id,
  };

  if (typeof caseBankId === 'string' && caseBankId) {
    const { error } = await supabase.from('case_banks').update(payload).eq('id', caseBankId);
    if (error) return { ok: false, error: 'unknown', values };
  } else {
    const { error } = await supabase
      .from('case_banks')
      .insert({ ...payload, created_by: userRes.user.id });
    if (error) return { ok: false, error: 'unknown', values };
  }

  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}`);
}

export async function deleteCaseBankAction(caseBankId: string, caseId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('case_banks').delete().eq('id', caseBankId);
  if (error) throw new Error(error.message);
  revalidatePath(`/cases/${caseId}`);
}
