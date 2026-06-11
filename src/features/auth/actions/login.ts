'use server';

import { redirect } from 'next/navigation';

import { getRequestIp } from '@/lib/http/request-ip';
import { checkRateLimit, refundRateLimit, type RateLimitConfig } from '@/lib/rate-limit';
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
  //   2. per (email, IP) 5/15min — lockout keyed on BOTH so an attacker's
  //      wrong passwords can't lock the victim out from their own IP.
  //   3. per email 20/15min across ALL IPs — bounds IP-rotation attacks.
  // The failure budgets (2+3) are consumed ATOMICALLY before the password
  // check — parallel attempts cannot race past the limit, the DB increment
  // IS the gate — and refunded below when the attempt turns out not to be a
  // failed guess (success / infra error), so legitimate logins never
  // accumulate lockout budget. Missing migration 164 only disables the
  // refund: strictly MORE blocking, never a silently disabled defense.
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
    if (!(await checkRateLimit(gate))) return { error: 'rate_limited' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Structured code first; legacy message sniff as fallback only. A failed
    // GUESS keeps the consumed budget; anything else (infra/unexpected) is
    // refunded so an outage can't lock users out.
    const badCredentials =
      error.code === 'invalid_credentials' ||
      error.message.toLowerCase().includes('invalid');
    if (badCredentials) return { error: 'invalid_credentials' };

    await Promise.all(failGates.map((gate) => refundRateLimit(gate)));
    return { error: 'unknown' };
  }

  await Promise.all(failGates.map((gate) => refundRateLimit(gate)));
  redirect(next);
}
