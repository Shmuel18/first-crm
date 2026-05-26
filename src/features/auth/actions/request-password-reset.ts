'use server';

import { env } from '@/lib/env';
import { getRequestIp } from '@/lib/http/request-ip';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

import { RequestPasswordResetSchema } from '../schemas/request-password-reset.schema';
import type { RequestPasswordResetState } from '../types';

/**
 * Sends a Supabase password-reset email. Returns `sent: true` regardless of
 * whether the address exists (and regardless of whether the rate-limiter
 * blocked the call) so the response is uniform — an attacker can't probe for
 * registered accounts by submitting candidate emails. The /auth/callback
 * route exchanges the recovery link's code for a session; the user lands on
 * /auth/set-password and re-uses the existing setPasswordAction.
 *
 * Layered throttle: per-IP (5/hour) catches spammers; per-email (3/hour)
 * caps the mailbox abuse for a single victim. Both fail-closed so a DB blip
 * doesn't disable the gate.
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
    // Same "looks like success" response — surfacing rate-limited would
    // turn this into an enumeration oracle just as cleanly as "user not
    // found".
    console.warn('[requestPasswordReset] throttled', { emailKey: emailMask(email) });
    return { sent: true };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/set-password`,
  });
  if (error) {
    console.error('[requestPasswordReset] supabase error', { code: error.code });
  }
  return { sent: true };
}

function emailMask(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return 'unparseable';
  return `${user.slice(0, 2)}***@${domain}`;
}
