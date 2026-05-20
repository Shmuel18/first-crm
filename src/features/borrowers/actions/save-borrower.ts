'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { BorrowerFormSchema } from '../schemas/borrower.schema';
import type { BorrowerActionState } from '../types';

export async function saveBorrowerAction(
  _prevState: BorrowerActionState,
  formData: FormData,
): Promise<BorrowerActionState> {
  const values = formDataToValues(formData);

  const caseId = formData.get('case_id');
  const borrowerId = formData.get('borrower_id');
  if (typeof caseId !== 'string' || !caseId) {
    return { ok: false, error: 'validation', values };
  }

  const parsed = BorrowerFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors, values };
  }

  const { role_in_case, is_primary, ...borrowerFields } = parsed.data;

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return { ok: false, error: 'unauthorized', values };
  }

  // Defense-in-depth: caller must be able to edit this case before any mutation.
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized', values };

  let finalBorrowerId: string;

  if (typeof borrowerId === 'string' && borrowerId) {
    // The borrower must already be linked to THIS case — otherwise a caller
    // with access to one case could overwrite a borrower belonging to another.
    const { data: link } = await supabase
      .from('case_borrowers')
      .select('borrower_id')
      .eq('case_id', caseId)
      .eq('borrower_id', borrowerId)
      .maybeSingle();
    if (!link) return { ok: false, error: 'unauthorized', values };

    // .select() confirms the update landed (0 rows = RLS denied → fail).
    const { data: updated, error } = await supabase
      .from('borrowers')
      .update({ ...borrowerFields, updated_by: userRes.user.id })
      .eq('id', borrowerId)
      .select('id');
    if (error) return { ok: false, error: 'unknown', values };
    if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized', values };

    const { error: linkError } = await supabase
      .from('case_borrowers')
      .update({ role_in_case, is_primary })
      .eq('case_id', caseId)
      .eq('borrower_id', borrowerId);
    if (linkError) return { ok: false, error: 'unknown', values };

    finalBorrowerId = borrowerId;
  } else {
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

  // Surface failure to update cases.primary_borrower_id instead of swallowing
  // it - otherwise the join table and the case row can disagree silently.
  if (is_primary) {
    const { error: primaryErr } = await supabase
      .from('cases')
      .update({ primary_borrower_id: finalBorrowerId })
      .eq('id', caseId);
    if (primaryErr) return { ok: false, error: 'unknown', values };
  }

  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}`);
}
