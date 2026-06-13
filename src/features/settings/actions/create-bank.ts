'use server';

import { revalidatePath } from 'next/cache';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { BankFormSchema, type BankActionState } from '../schemas/bank.schema';
import { generateBankKey, nextBankSortOrder } from '../services/banks.service';

export async function createBankAction(
  _prevState: BankActionState,
  formData: FormData,
): Promise<BankActionState> {
  const values = formDataToValues(formData);

  const parsed = BankFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors, values };
  }
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized', values };

  const supabase = await createClient();
  const key = await generateBankKey(parsed.data.name_en);
  const sortOrder = await nextBankSortOrder();

  const insertBank = (bankKey: string) =>
    supabase
      .from('banks')
      .insert({
        key: bankKey,
        name_he: parsed.data.name_he,
        name_en: parsed.data.name_en,
        lender_type: parsed.data.lender_type,
        color: parsed.data.color,
        logo_url: parsed.data.logo_url ?? null,
        is_active: parsed.data.is_active,
        sort_order: sortOrder,
        is_system: false,
      })
      .select('id')
      .single();

  let { data, error } = await insertBank(key);
  // 23505 = unique key collision (two admins creating similarly-named lenders
  // concurrently — generateBankKey's read/insert isn't atomic). Retry once
  // with a timestamped key instead of failing the whole create.
  if (error?.code === '23505') {
    ({ data, error } = await insertBank(`${key}_${Date.now()}`));
  }

  if (error || !data) {
    console.error('[createBank] insert failed', error?.code);
    return { ok: false, error: 'unknown', values };
  }

  revalidatePath('/settings/banks');
  return { ok: true, bankId: data.id };
}
