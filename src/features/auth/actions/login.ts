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

  // Layered brute-force defense. The IP gate catches credential-stuffing
  // from a single host; the per-email gate catches the same attacker
  // rotating IPs against one account. Both use failMode='closed' so a
  // transient DB outage can't silently disable the limiter — better to
  // refuse a few legitimate logins for ~minute than open the door.
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
  const emailOk = await checkRateLimit({
    action: 'login_attempt',
    subject: `email:${emailKey}`,
    max: 5,
    windowSeconds: 900,
    failMode: 'closed',
  });
  if (!emailOk) return { error: 'rate_limited' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.message.toLowerCase().includes('invalid')) {
      return { error: 'invalid_credentials' };
    }
    return { error: 'unknown' };
  }

  redirect(next);
}
