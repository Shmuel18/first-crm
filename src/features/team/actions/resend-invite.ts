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
 * delete-from-DB-then-reinvite dance.
 *
 * Uses a `magiclink` (passwordless sign-in), NOT `recovery`: generateLink
 * type:'invite' errors "email exists" on a known user, and type:'recovery'
 * fails for an invited member who never set a password (there's nothing to
 * "recover" → verifyOtp rejects it, surfaced as invalid_invite). magiclink
 * signs in any confirmed user regardless of password state, then /auth/confirm
 * forwards to /auth/set-password.
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
    .select('email, first_name, is_active')
    .eq('id', userId)
    .is('deleted_at', null)
    .single();
  if (profErr || !profile?.email) return { ok: false, error: 'not_found' };

  // SCOPE GUARD (R3-team-1): a magiclink is a full passwordless sign-in, so it
  // may only be minted for a member who has NEVER completed onboarding. For a
  // member who already signed in it would hand the admin a link that logs in
  // AS that user (impersonation + audit rows attributed to the victim).
  // Inactive members are refused too — reactivate first, then resend.
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  if (!profile.is_active || authUser?.user?.last_sign_in_at) {
    return { ok: false, error: 'not_allowed' };
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: profile.email,
  });
  const tokenHash = linkData?.properties?.hashed_token ?? null;
  if (linkErr || !tokenHash) return { ok: false, error: 'unknown' };

  const inviteLink = `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=/auth/set-password`;

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
