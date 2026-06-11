'use server';

import { redirect } from 'next/navigation';

import { getRequestIp } from '@/lib/http/request-ip';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

import { LoginSchema } from '../schemas/login.schema';
import type { LoginState } from '../types';

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  };

  // `next` is attacker-controllable (it comes from the URL via a hidden
  // input), so it MUST be a same-origin app path. Reject anything that
  // doesn't start with a single `/` (protocol-relative `//`, backslash
  // `/\`, or an absolute URL). Mirrors the /auth/callback convention.
  const nextRaw = formData.get('next');
  const next =
    typeof nextRaw === 'string' &&
    nextRaw.startsWith('/') &&
    !nextRaw.startsWith('//') &&
    !nextRaw.startsWith('/\\')
      ? nextRaw
      : '/cases';

  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: 'invalid_input' };
  }

  // Layered brute-force defense, all failMode='closed' so a transient DB
  // outage can't silently disable the limiter — better to refuse a few
  // legitimate logins for ~a minute than open the door.
  //   1. Per-IP: catches credential-stuffing from a single host.
  //   2. Per (email, IP): the account-lockout gate. Keyed on BOTH so an
  //      attacker burning wrong passwords from their own IP can't lock the
  //      real user out from theirs (R1-auth-4 targeted-lockout DoS).
  //   3. Per email across ALL IPs: a wider backstop that bounds a
  //      distributed (IP-rotating) attack against one account. Trade-off:
  //      ~20 distributed failures still deny that account for the window —
  //      fully eliminating that needs CAPTCHA, accepted for now.
  // Gates run sequentially so an IP-blocked flood never consumes the
  // victim account's cross-IP budget.
  const ip = await getRequestIp();
  const ipOk = await checkRateLimit({
    action: 'login_attempt',
    subject: `ip:${ip}`,
    max: 10,
    windowSeconds: 60,
    failMode: 'closed',
  });
  if (!ipOk) return { error: 'rate_limited' };

  const emailKey = parsed.data.email.toLowerCase().trim();
  const emailIpOk = await checkRateLimit({
    action: 'login_attempt',
    subject: `email:${emailKey}:ip:${ip}`,
    max: 5,
    windowSeconds: 900,
    failMode: 'closed',
  });
  if (!emailIpOk) return { error: 'rate_limited' };

  const emailOk = await checkRateLimit({
    action: 'login_attempt_global',
    subject: `email:${emailKey}`,
    max: 20,
    windowSeconds: 900,
    failMode: 'closed',
  });
  if (!emailOk) return { error: 'rate_limited' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Classify on the structured error code (stable API), with the legacy
    // message sniff only as a fallback for SDK versions that omit `code`.
    if (
      error.code === 'invalid_credentials' ||
      error.message.toLowerCase().includes('invalid')
    ) {
      return { error: 'invalid_credentials' };
    }
    return { error: 'unknown' };
  }

  redirect(next);
}
