'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { BorrowerFormSchema } from '../schemas/borrower.schema';
import type { BorrowerActionState } from '../types';

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

export async function saveBorrowerAction(
  _prevState: BorrowerActionState,
  formData: FormData,
): Promise<BorrowerActionState> {
  const values = formDataToValues(formData);

  const caseId = formData.get('case_id');
  const borrowerId = formData.get('borrower_id'); // empty for create
  if (typeof caseId !== 'string' || !caseId) {
    return { ok: false, error: 'validation', values };
  }

  const parsed = BorrowerFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.');
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, error: 'validation', fieldErrors, values };
  }

  const { role_in_case, is_primary, ...borrowerFields } = parsed.data;

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return { ok: false, error: 'unauthorized', values };
  }

  let finalBorrowerId: string;

  if (typeof borrowerId === 'string' && borrowerId) {
    // Edit existing borrower
    const { error } = await supabase
      .from('borrowers')
      .update({ ...borrowerFields, updated_by: userRes.user.id })
      .eq('id', borrowerId);
    if (error) return { ok: false, error: 'unknown', values };

    const { error: linkError } = await supabase
      .from('case_borrowers')
      .update({ role_in_case, is_primary })
      .eq('case_id', caseId)
      .eq('borrower_id', borrowerId);
    if (linkError) return { ok: false, error: 'unknown', values };

    finalBorrowerId = borrowerId;
  } else {
    // Create new borrower + link to case
    const { data: newBorrower, error } = await supabase
      .from('borrowers')
      .insert({
        ...borrowerFields,
        created_by: userRes.user.id,
        updated_by: userRes.user.id,
      })
      .select('id')
      .single();
    if (error || !newBorrower) return { ok: false, error: 'unknown', values };

    const { error: linkError } = await supabase.from('case_borrowers').insert({
      case_id: caseId,
      borrower_id: newBorrower.id,
      role_in_case,
      is_primary,
    });
    if (linkError) return { ok: false, error: 'unknown', values };

    finalBorrowerId = newBorrower.id;
  }

  // If this is marked as primary, also update cases.primary_borrower_id
  if (is_primary) {
    await supabase
      .from('cases')
      .update({ primary_borrower_id: finalBorrowerId })
      .eq('id', caseId);
  }

  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}`);
}

export async function removeBorrowerFromCaseAction(
  caseId: string,
  borrowerId: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('case_borrowers')
    .delete()
    .eq('case_id', caseId)
    .eq('borrower_id', borrowerId);
  if (error) throw new Error(error.message);
  revalidatePath(`/cases/${caseId}`);
}
