'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { TemplateFormSchema } from '../schemas/template.schema';
import { updateMessageTemplate } from '../services/templates.service';
import type { TemplateActionState } from '../types';

export async function updateTemplateAction(
  _prevState: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const values = formDataToValues(formData);

  const idParsed = z.uuid().safeParse(formData.get('template_id'));
  if (!idParsed.success) return { ok: false, error: 'validation', values };

  const parsed = TemplateFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized', values };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized', values };

  const ok = await updateMessageTemplate(
    idParsed.data,
    {
      name: parsed.data.name,
      channel: parsed.data.channel,
      subject: parsed.data.subject ?? null,
      body: parsed.data.body,
    },
    userRes.user.id,
  );
  if (!ok) return { ok: false, error: 'unauthorized', values };

  revalidatePath('/settings/templates');
  return { ok: true, templateId: idParsed.data };
}
