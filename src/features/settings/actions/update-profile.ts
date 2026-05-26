'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { ProfileFormSchema } from '../schemas/profile.schema';
import type { SettingsActionState } from '../types';

const LOCALE_COOKIE = 'NEXT_LOCALE';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function updateProfileAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const values = formDataToValues(formData);

  const parsed = ProfileFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized', values };

  // profiles_update_self RLS restricts this to the caller's own row.
  const { data: updated, error } = await supabase
    .from('profiles')
    .update({
      first_name: parsed.data.first_name ?? null,
      last_name: parsed.data.last_name ?? null,
      phone: parsed.data.phone ?? null,
      language: parsed.data.language,
      updated_by: userRes.user.id,
    })
    .eq('id', userRes.user.id)
    .select('id');

  if (error) return { ok: false, error: 'unknown', values };
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized', values };

  // Keep the UI locale cookie in sync with the saved preference. httpOnly:
  // false is intentional — next-intl reads this from client-side code on
  // hard navigations.
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, parsed.data.language, {
    maxAge: ONE_YEAR_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    httpOnly: false,
  });

  revalidatePath('/', 'layout');
  return { ok: true };
}
