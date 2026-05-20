'use server';

import { revalidatePath } from 'next/cache';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { OfficeFormSchema } from '../schemas/office.schema';
import type { SettingsActionState } from '../types';

export async function updateOfficeAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const values = formDataToValues(formData);

  const parsed = OfficeFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized', values };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized', values };

  const { data: updated, error } = await supabase
    .from('office_settings')
    .update({ ...parsed.data, updated_by: userRes.user.id })
    .eq('id', 1)
    .select('id');

  if (error) return { ok: false, error: 'unknown', values };
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized', values };

  revalidatePath('/settings/office');
  return { ok: true };
}
