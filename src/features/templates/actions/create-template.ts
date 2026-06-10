'use server';

import { revalidatePath } from 'next/cache';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { TemplateFormSchema } from '../schemas/template.schema';
import { insertMessageTemplate } from '../services/templates.service';
import type { TemplateActionState } from '../types';

export async function createTemplateAction(
  _prevState: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const values = formDataToValues(formData);

  const parsed = TemplateFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized', values };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized', values };

  const id = await insertMessageTemplate(
    {
      name: parsed.data.name,
      channel: parsed.data.channel,
      subject: parsed.data.subject ?? null,
      body: parsed.data.body,
    },
    userRes.user.id,
  );
  if (!id) return { ok: false, error: 'unknown', values };

  revalidatePath('/settings/templates');
  return { ok: true, templateId: id };
}
