'use server';

import { getLocale } from 'next-intl/server';

import { env, isEmailConfigured } from '@/lib/env';
import { getRequestIp } from '@/lib/http/request-ip';
import { checkRateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';

import { RequestPasswordResetSchema } from '../schemas/request-password-reset.schema';
import { sendPasswordResetEmail } from '../services/auth-email';
import type { RequestPasswordResetState } from '../types';

/**
 * Sends a password-reset email via Resend — NOT Supabase's built-in SMTP, which
 * is unconfigured on this project and failed silently (a locked-out manager had
 * no recovery path). We mint a `recovery` link with the admin API and mail it
 * ourselves, exactly like the team-invite flow; /auth/confirm verifies the
 * token (token_hash flow) and forwards to /auth/set-password.
 *
 * Enumeration-safe: returns `sent: true` whether or not the address has an
 * account (and whether or not the rate-limiter blocked the call). The one
 * non-uniform signal — `email_unconfigured` — is system-level, not per-account,
 * so it leaks nothing about who is registered.
 *
 * Layered throttle: per-IP (5/hour) catches spammers; per-email (3/hour) caps
 * mailbox abuse for a single victim. Both fail-closed.
 */
export async function requestPasswordResetAction(
  _prev: RequestPasswordResetState,
  formData: FormData,
): Promise<RequestPasswordResetState> {
  const parsed = RequestPasswordResetSchema.safeParse({
    email: formData.get('email'),
  });
  if (!parsed.success) {
    return { sent: false, error: 'invalid_input' };
  }

  // System-level (not per-account) → safe to surface. Without it the request
  // would "succeed" while sending nothing — the silent dead-end we're fixing.
  if (!isEmailConfigured()) {
    return { sent: false, error: 'email_unconfigured' };
  }

  const ip = await getRequestIp();
  const email = parsed.data.email.toLowerCase().trim();

  const ipOk = await checkRateLimit({
    action: 'password_reset',
    subject: `ip:${ip}`,
    max: 5,
    windowSeconds: 3600,
    failMode: 'closed',
  });
  const emailOk = await checkRateLimit({
    action: 'password_reset',
    subject: `email:${email}`,
    max: 3,
    windowSeconds: 3600,
    failMode: 'closed',
  });

  if (!ipOk || !emailOk) {
    // Same "looks like success" response — surfacing rate-limited would turn
    // this into an enumeration oracle just as cleanly as "user not found".
    console.warn('[requestPasswordReset] throttled', { emailKey: emailMask(email) });
    return { sent: true };
  }

  const admin = createAdminClient();
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
  });
  const tokenHash = linkData?.properties?.hashed_token ?? null;
  if (linkErr || !tokenHash) {
    // No such account (or a transient API hiccup). Stay enumeration-safe: log
    // server-side and return the SAME success state as a real send.
    console.warn('[requestPasswordReset] no link', { emailKey: emailMask(email) });
    return { sent: true };
  }

  const resetLink = `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/auth/set-password`;
  const locale = (await getLocale()) === 'en' ? 'en' : 'he';
  await sendPasswordResetEmail({ to: email, resetLink, locale });

  return { sent: true };
}

function emailMask(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return 'unparseable';
  return `${user.slice(0, 2)}***@${domain}`;
}
