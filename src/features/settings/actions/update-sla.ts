'use server';

import { revalidatePath } from 'next/cache';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { SlaFormSchema, formInputToThresholds } from '../schemas/sla.schema';
import type { SettingsActionState } from '../types';

export async function updateSlaAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const values = formDataToValues(formData);

  const parsed = SlaFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized', values };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized', values };

  const thresholds = formInputToThresholds(parsed.data);

  const { data: updated, error } = await supabase
    .from('office_settings')
    .update({
      sla_status_thresholds: thresholds,
      updated_by: userRes.user.id,
    })
    .eq('id', 1)
    .select('id');

  if (error) {
    console.error('[update-sla] update failed', { message: error.message });
    return { ok: false, error: 'unknown', values };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized', values };

  // SLA settings live under /settings/notifications as of the Status-times
  // consolidation. Revalidate that path so the form re-renders with the
  // freshly-saved thresholds.
  revalidatePath('/settings/notifications');
  return { ok: true };
}
