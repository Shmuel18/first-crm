'use server';

import { revalidatePath } from 'next/cache';

import { getLocale } from 'next-intl/server';

import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { InviteMemberSchema } from '../schemas/team.schema';
import { sendInviteEmail } from '../services/team-email';
import type { InviteActionState } from '../types';

/**
 * Invite a new team member via Supabase's single-use invite link. The new
 * user picks their OWN password at /auth/set-password — admin never sees
 * it. On email failure the one-time link is returned to the dialog so the
 * admin can share it manually (still single-use, still short-lived).
 */
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
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized', values };

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) return { ok: false, error: 'unauthorized', values };

  // Cap admin throughput so a compromised admin session can't burn invites
  // to enumerate emails (admin.generateLink returns a distinct error when
  // the address already exists). Legitimate bulk-invite is rare.
  const ok = await checkRateLimit({
    action: 'invite_member',
    subject: `user:${userRes.user.id}`,
    max: 10,
    windowSeconds: 3600,
    failMode: 'closed',
  });
  if (!ok) return { ok: false, error: 'rate_limited', values };

  const { email, first_name, last_name, phone, role_id } = parsed.data;

  const admin = createAdminClient();

  // Supabase appends ?code=... (and type=invite) to the redirectTo URL. Our
  // /auth/callback exchanges the code for a session, then forwards to
  // `next` which puts the user on the set-password page.
  const redirectTo = `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/set-password`;

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo },
  });

  if (linkErr || !linkData.user) {
    const msg = linkErr?.message?.toLowerCase() ?? '';
    if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
      return { ok: false, error: 'email_exists', values };
    }
    return { ok: false, error: 'unknown', values };
  }

  const inviteLink = linkData.properties?.action_link ?? null;
  if (!inviteLink) {
    // Defensive: generateLink shouldn't succeed without action_link, but if
    // the Supabase API changes shape we'd rather fail loudly than create a
    // user nobody can finish onboarding.
    await admin.auth.admin.deleteUser(linkData.user.id);
    return { ok: false, error: 'unknown', values };
  }

  // The handle_new_user trigger created a default profile; fill in chosen values.
  const { error: updateErr } = await admin
    .from('profiles')
    .update({ first_name, last_name, phone: phone ?? null, role_id })
    .eq('id', linkData.user.id);

  if (updateErr) {
    // Roll back the auth user so the admin can retry cleanly.
    await admin.auth.admin.deleteUser(linkData.user.id);
    return { ok: false, error: 'unknown', values };
  }

  const locale = (await getLocale()) === 'en' ? 'en' : 'he';
  const emailed = await sendInviteEmail({
    to: email,
    firstName: first_name,
    inviteLink,
    locale,
  });

  revalidatePath('/team');
  return {
    ok: true,
    email,
    emailed,
    // Only return the link when the email failed — successful emails mean
    // the link should not echo back into client memory at all.
    inviteLink: emailed ? null : inviteLink,
  };
}
