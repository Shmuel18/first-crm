'use server';

import { redirect } from 'next/navigation';

import { getRequestIp } from '@/lib/http/request-ip';
import { checkRateLimit, peekRateLimit, type RateLimitConfig } from '@/lib/rate-limit';
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

  // Layered brute-force defense (failMode 'closed': a DB blip refuses a few
  // logins rather than silently disabling the limiter):
  //   1. per-IP attempts 10/min — credential-stuffing from a single host.
  //   2. per (email, IP) failures 5/15min — keyed on BOTH so an attacker's
  //      wrong passwords can't lock the victim out from their own IP.
  //   3. per email failures 20/15min across ALL IPs — bounds IP-rotation
  //      attacks (a distributed attacker can still deny the account for the
  //      window; the full fix is CAPTCHA, accepted for now).
  // Failure budgets are PEEKED here and CONSUMED only after a failed
  // password check below, so successful logins never burn lockout budget.
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
  const failGates: RateLimitConfig[] = [
    {
      action: 'login_fail',
      subject: `email:${emailKey}:ip:${ip}`,
      max: 5,
      windowSeconds: 900,
      failMode: 'closed',
    },
    {
      action: 'login_fail_global',
      subject: `email:${emailKey}`,
      max: 20,
      windowSeconds: 900,
      failMode: 'closed',
    },
  ];
  for (const gate of failGates) {
    if (!(await peekRateLimit(gate))) return { error: 'rate_limited' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Structured code first; legacy message sniff as fallback only.
    const badCredentials =
      error.code === 'invalid_credentials' ||
      error.message.toLowerCase().includes('invalid');
    if (!badCredentials) return { error: 'unknown' };

    // Only confirmed credential failures consume lockout budget — infra
    // errors ('unknown' above) must not lock users out during an outage.
    let overLimit = false;
    for (const gate of failGates) {
      if (!(await checkRateLimit(gate))) overLimit = true;
    }
    return { error: overLimit ? 'rate_limited' : 'invalid_credentials' };
  }

  redirect(next);
}
