'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { asBorrowerId, asCaseId } from '@/lib/types/branded';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { ObligationFormSchema } from '../schemas/obligation.schema';
import { borrowerIsOnCase } from '@/features/borrowers/services/borrowers.service';
import type { ObligationActionState } from '../types';

export async function saveObligationAction(
  _prevState: ObligationActionState,
  formData: FormData,
): Promise<ObligationActionState> {
  const values = formDataToValues(formData);
  const caseId = formData.get('case_id');
  const obligationId = formData.get('obligation_id');

  if (typeof caseId !== 'string' || !caseId) {
    return { ok: false, error: 'validation', values };
  }

  const parsed = ObligationFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized', values };

  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized', values };
  if (!(await borrowerIsOnCase(asCaseId(caseId), asBorrowerId(parsed.data.borrower_id)))) {
    return { ok: false, error: 'unauthorized', values };
  }

  const payload = {
    ...parsed.data,
    updated_by: userRes.user.id,
  };

  let finalId: string;
  if (typeof obligationId === 'string' && obligationId) {
    const { data: updated, error } = await supabase
      .from('borrower_obligations')
      .update(payload)
      .eq('id', obligationId)
      .eq('borrower_id', parsed.data.borrower_id)
      .select('id');
    if (error) return { ok: false, error: 'unknown', values };
    if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized', values };
    finalId = obligationId;
  } else {
    const { data: created, error } = await supabase
      .from('borrower_obligations')
      .insert({ ...payload, created_by: userRes.user.id })
      .select('id')
      .single();
    if (error || !created) return { ok: false, error: 'unknown', values };
    finalId = created.id;
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true, obligationId: finalId };
}
