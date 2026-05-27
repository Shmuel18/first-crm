'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { asBorrowerId, asCaseId } from '@/lib/types/branded';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { IncomeFormSchema } from '../schemas/income.schema';
import { borrowerIsOnCase } from '@/features/borrowers/services/borrowers.service';
import type { IncomeActionState } from '../types';

export async function saveIncomeAction(
  _prevState: IncomeActionState,
  formData: FormData,
): Promise<IncomeActionState> {
  const values = formDataToValues(formData);
  const caseId = formData.get('case_id');
  const incomeId = formData.get('income_id'); // empty for create

  if (typeof caseId !== 'string' || !caseId) {
    return { ok: false, error: 'validation', values };
  }

  const parsed = IncomeFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized', values };

  // Two-layer authorization: caller can edit this case, AND the borrower
  // the form points at actually belongs to this case (otherwise an attacker
  // who can edit case A could attach incomes to a borrower on case B).
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized', values };
  if (!(await borrowerIsOnCase(asCaseId(caseId), asBorrowerId(parsed.data.borrower_id)))) {
    return { ok: false, error: 'unauthorized', values };
  }

  const payload = {
    ...parsed.data,
    updated_by: userRes.user.id,
  };

  let finalId: string;
  if (typeof incomeId === 'string' && incomeId) {
    const { data: updated, error } = await supabase
      .from('borrower_incomes')
      .update(payload)
      .eq('id', incomeId)
      .eq('borrower_id', parsed.data.borrower_id)
      .is('deleted_at', null)
      .select('id');
    if (error) return { ok: false, error: 'unknown', values };
    if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized', values };
    finalId = incomeId;
  } else {
    const { data: created, error } = await supabase
      .from('borrower_incomes')
      .insert({ ...payload, created_by: userRes.user.id })
      .select('id')
      .single();
    if (error || !created) return { ok: false, error: 'unknown', values };
    finalId = created.id;
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true, incomeId: finalId };
}
