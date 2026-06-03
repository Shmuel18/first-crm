'use server';

import { getLocale } from 'next-intl/server';

import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import { sendInviteEmail } from '../services/team-email';
import type { ResendInviteResult } from '../types';

/**
 * Re-issue a fresh set-password link for an EXISTING member — e.g. their first
 * invite link expired or was consumed by a link-preview bot. Avoids the
 * delete-from-DB-then-reinvite dance: generateLink({type:'invite'}) errors with
 * "email exists" on a known user, so we mint a `recovery` link instead (valid
 * for existing users) that lands on /auth/set-password via /auth/confirm.
 *
 * Emails it when Resend is configured; otherwise returns the one-time link for
 * the admin to share manually (mirrors inviteMemberAction).
 */
export async function resendInviteAction(userId: string): Promise<ResendInviteResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) return { ok: false, error: 'unauthorized' };

  // Cap throughput so a compromised admin session can't farm reset links.
  const ok = await checkRateLimit({
    action: 'resend_invite',
    subject: `user:${userRes.user.id}`,
    max: 20,
    windowSeconds: 3600,
    failMode: 'closed',
  });
  if (!ok) return { ok: false, error: 'rate_limited' };

  const admin = createAdminClient();

  // profiles is the source of truth for the member's email + name.
  const { data: profile, error: profErr } = await admin
    .from('profiles')
    .select('email, first_name')
    .eq('id', userId)
    .is('deleted_at', null)
    .single();
  if (profErr || !profile?.email) return { ok: false, error: 'not_found' };

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: profile.email,
  });
  const tokenHash = linkData?.properties?.hashed_token ?? null;
  if (linkErr || !tokenHash) return { ok: false, error: 'unknown' };

  const inviteLink = `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/auth/set-password`;

  const locale = (await getLocale()) === 'en' ? 'en' : 'he';
  const emailed = await sendInviteEmail({
    to: profile.email,
    firstName: profile.first_name ?? '',
    inviteLink,
    locale,
  });

  // Mirror invite: only echo the link back when the email didn't go out.
  return { ok: true, emailed, inviteLink: emailed ? null : inviteLink };
}
