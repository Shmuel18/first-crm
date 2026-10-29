import 'server-only';

import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { ContactFormSchema, type ContactActionState, type ContactFormInput } from '../schemas/contact.schema';

/** Parse + validate a contact form; on failure returns the ready error state. */
export async function parseContactForm(
  formData: FormData,
): Promise<{ ok: true; data: ContactFormInput } | { ok: false; state: ContactActionState }> {
  const values = formDataToValues(formData);
  const parsed = ContactFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, state: { ok: false, error: 'validation', fieldErrors, values } };
  }
  return { ok: true, data: parsed.data };
}
