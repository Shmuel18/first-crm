'use server';

import { randomInt } from 'crypto';

import { revalidatePath } from 'next/cache';

import { getLocale } from 'next-intl/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { InviteMemberSchema } from '../schemas/team.schema';
import { sendInviteEmail } from '../services/team-email';
import type { InviteActionState } from '../types';

export async function inviteMemberAction(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const values = formDataToValues(formData);

  const parsed = InviteMemberSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) return { ok: false, error: 'unauthorized', values };

  const { email, first_name, last_name, phone, role_id } = parsed.data;
  const tempPassword = generateTempPassword();

  const admin = createAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createErr || !created.user) {
    const msg = createErr?.message?.toLowerCase() ?? '';
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
      return { ok: false, error: 'email_exists', values };
    }
    return { ok: false, error: 'unknown', values };
  }

  // The handle_new_user trigger created a profile (default junior_advisor).
  // Fill in the chosen name/phone/role.
  const { error: updateErr } = await admin
    .from('profiles')
    .update({ first_name, last_name, phone: phone ?? null, role_id })
    .eq('id', created.user.id);

  if (updateErr) {
    // Roll back the orphaned auth user so the admin can retry cleanly.
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: 'unknown', values };
  }

  // Best-effort: email the credentials. If it doesn't go out (email not
  // configured or send failed), the dialog still shows the temp password so
  // the admin can share it manually.
  const locale = (await getLocale()) === 'en' ? 'en' : 'he';
  const emailed = await sendInviteEmail({ to: email, firstName: first_name, tempPassword, locale });

  revalidatePath('/team');
  return { ok: true, tempPassword, email, emailed };
}

function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const pick = (set: string) => set[randomInt(set.length)];

  const chars = [pick(upper), pick(lower), pick(digits), pick(digits)];
  for (let i = 0; i < 8; i++) chars.push(pick(all));

  // Fisher-Yates shuffle so the guaranteed classes aren't always in front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}
