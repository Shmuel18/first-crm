'use server';

import { revalidatePath } from 'next/cache';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { BankFormSchema, type BankActionState } from '../schemas/bank.schema';

export async function updateBankAction(
  _prevState: BankActionState,
  formData: FormData,
): Promise<BankActionState> {
  const values = formDataToValues(formData);
  const id = formData.get('bank_id');
  if (typeof id !== 'string' || !id) return { ok: false, error: 'not_found', values };

  const parsed = BankFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors, values };
  }
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized', values };

  const supabase = await createClient();
  // key + is_system are immutable — a stable key keeps existing references intact.
  const { error } = await supabase
    .from('banks')
    .update({
      name_he: parsed.data.name_he,
      name_en: parsed.data.name_en,
      lender_type: parsed.data.lender_type,
      color: parsed.data.color,
      logo_url: parsed.data.logo_url ?? null,
      is_active: parsed.data.is_active,
    })
    .eq('id', id);

  if (error) {
    console.error('[updateBank] update failed', error.code);
    return { ok: false, error: 'unknown', values };
  }

  revalidatePath('/settings/banks');
  return { ok: true, bankId: id };
}
