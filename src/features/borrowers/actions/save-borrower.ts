'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { BorrowerFormSchema } from '../schemas/borrower.schema';
import { saveBorrowerForCase } from '../services/borrowers.service';
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
  if (!userRes.user) return { ok: false, error: 'unauthorized', values };

  // Defense-in-depth: caller must be able to edit this case before any mutation.
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized', values };

  const result = await saveBorrowerForCase({
    caseId,
    borrowerId: typeof borrowerId === 'string' && borrowerId ? borrowerId : null,
    borrowerFields,
    roleInCase: role_in_case,
    isPrimary: is_primary,
    userId: userRes.user.id,
  });
  if (!result.ok) return { ok: false, error: result.error, values };

  revalidatePath(`/cases/${caseId}`);
  redirect(`/cases/${caseId}`);
}
