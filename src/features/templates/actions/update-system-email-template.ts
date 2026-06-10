'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { SYSTEM_EMAIL_TEMPLATE_DEFINITIONS } from '../domain/system-email-templates';
import { SystemEmailTemplateFormSchema } from '../schemas/system-email-template.schema';
import type { TemplateActionState } from '../types';

export async function updateSystemEmailTemplateAction(
  _prevState: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const values = formDataToValues(formData);
  const parsed = SystemEmailTemplateFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation',
      fieldErrors: await resolveSchemaErrors(parsed.error),
      values,
    };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user || !(await isCurrentUserAdmin())) {
    return { ok: false, error: 'unauthorized', values };
  }

  const definition = SYSTEM_EMAIL_TEMPLATE_DEFINITIONS[parsed.data.template_key];
  const { error } = await (supabase as unknown as SupabaseClient)
    .from('system_email_templates')
    .upsert(
      {
        template_key: parsed.data.template_key,
        locale: parsed.data.locale,
        subject: parsed.data.subject,
        heading: parsed.data.heading,
        body: parsed.data.body,
        cta_label: parsed.data.cta_label,
        is_enabled: definition.critical ? true : parsed.data.is_enabled,
        updated_by: userRes.user.id,
      },
      { onConflict: 'template_key,locale' },
    );
  if (error) return { ok: false, error: 'unknown', values };

  revalidatePath('/settings/templates');
  return { ok: true, templateId: `${parsed.data.template_key}:${parsed.data.locale}` };
}

