'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

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
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return { ok: false, error: 'unauthorized', values };
  }

  // Defense-in-depth: caller must be able to edit the owning case.
  if (!(await userCanEditCase(caseId))) {
    return { ok: false, error: 'unauthorized', values };
  }

  const payload = {
    case_id: caseId,
    ...parsed.data,
    updated_by: userRes.user.id,
  };

  if (typeof caseBankId === 'string' && caseBankId) {
    // Scope the update to this case and confirm a row changed (0 rows = RLS
    // denied / wrong case → fail instead of false success).
    const { data: updated, error } = await supabase
      .from('case_banks')
      .update(payload)
      .eq('id', caseBankId)
      .eq('case_id', caseId)
      .select('id');
    if (error) return { ok: false, error: 'unknown', values };
    if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized', values };
  } else {
    const { error } = await supabase
      .from('case_banks')
      .insert({ ...payload, created_by: userRes.user.id });
    if (error) return { ok: false, error: 'unknown', values };
  }

  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}`);
}

type DeleteResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'unknown'; message?: string };

export async function deleteCaseBankAction(
  caseBankId: string,
  caseId: string,
): Promise<DeleteResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // Defense-in-depth: caller must be able to edit the owning case.
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  // Soft-delete: hard DELETE is blocked by RLS (#37 hardening). Keeps history
  // for audit and lets retention purge clean it up later.
  const { data: deleted, error } = await supabase
    .from('case_banks')
    // Clear is_primary on removal so a deleted row is never left flagged primary.
    .update({ deleted_at: new Date().toISOString(), is_primary: false, updated_by: userRes.user.id })
    .eq('id', caseBankId)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .select('id');
  if (error) {
    console.error('[saveCaseBank/delete] db error', error);
    return { ok: false, error: 'unknown' };
  }
  if (!deleted || deleted.length === 0) return { ok: false, error: 'unauthorized' };

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
