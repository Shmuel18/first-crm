'use server';

import { after } from 'next/server';

import { getLocale } from 'next-intl/server';

import { env, isEmailConfigured } from '@/lib/env';
import { padToMinDuration } from '@/lib/http/min-duration';
import { getRequestIp } from '@/lib/http/request-ip';
import { checkRateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';

import { emailMask } from '../domain/email-mask';
import { RequestPasswordResetSchema } from '../schemas/request-password-reset.schema';
import { sendPasswordResetEmail } from '../services/auth-email';
import type { RequestPasswordResetState } from '../types';

/**
 * Resend-based password reset (Supabase SMTP is unconfigured): mints a
 * `recovery` link via the admin API; /auth/confirm verifies the token_hash
 * and forwards to /auth/set-password. Enumeration-safe on BOTH channels —
 * content (`{ sent: true }` for real, missing, and throttled accounts alike)
 * AND timing (the Resend send runs via after(), and every account-dependent
 * exit is padded to RESET_FLOOR_MS so generateLink latency variance can't
 * distinguish real accounts). Throttle: IP 5/h + email 3/h, fail-closed.
 */
const RESET_FLOOR_MS = 600;

export async function requestPasswordResetAction(
  _prev: RequestPasswordResetState,
  formData: FormData,
): Promise<RequestPasswordResetState> {
  const startedAt = Date.now();

  const parsed = RequestPasswordResetSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { sent: false, error: 'invalid_input' };

  // System-level (not per-account) → safe to surface immediately.
  if (!isEmailConfigured()) return { sent: false, error: 'email_unconfigured' };

  const ip = await getRequestIp();
  const email = parsed.data.email.toLowerCase().trim();

  const [ipOk, emailOk] = await Promise.all([
    checkRateLimit({
      action: 'password_reset',
      subject: `ip:${ip}`,
      max: 5,
      windowSeconds: 3600,
      failMode: 'closed',
    }),
    checkRateLimit({
      action: 'password_reset',
      subject: `email:${email}`,
      max: 3,
      windowSeconds: 3600,
      failMode: 'closed',
    }),
  ]);

  if (!ipOk || !emailOk) {
    // Surfacing rate-limited would be an enumeration oracle of its own.
    console.warn('[requestPasswordReset] throttled', { emailKey: emailMask(email) });
    return sentUniformly(startedAt);
  }

  // Locale BEFORE the existence check — same request-context work up front.
  const locale = (await getLocale()) === 'en' ? 'en' : 'he';

  const admin = createAdminClient();
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
  });
  const tokenHash = linkData?.properties?.hashed_token ?? null;
  if (linkErr || !tokenHash) {
    // No such account (or transient hiccup) — same response as a real send.
    console.warn('[requestPasswordReset] no link', { emailKey: emailMask(email) });
    return sentUniformly(startedAt);
  }

  const resetLink = `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/auth/set-password`;

  // Off the response path (R1-auth-1) — see timing note in the header.
  after(async () => {
    const ok = await sendPasswordResetEmail({ to: email, resetLink, locale });
    if (!ok) {
      console.warn('[requestPasswordReset] send failed', { emailKey: emailMask(email) });
    }
  });

  return sentUniformly(startedAt);
}

async function sentUniformly(startedAt: number): Promise<RequestPasswordResetState> {
  await padToMinDuration(startedAt, RESET_FLOOR_MS);
  return { sent: true };
}
