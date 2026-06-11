'use server';

import { redirect } from 'next/navigation';

import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

import { SetPasswordSchema } from '../schemas/set-password.schema';

import type { SetPasswordState } from '../types';

/**
 * Sets the signed-in user's password. Used by the invite-callback flow:
 *   1. Admin invites → Supabase generates a single-use link.
 *   2. New user clicks link → /auth/callback exchanges code → session cookies set.
 *   3. Callback redirects here → user picks their own password.
 *
 * Also doubles as a "change password" page for any logged-in user, since
 * `auth.updateUser({ password })` is the same operation in both flows.
 */
export async function setPasswordAction(
  _prev: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const raw = {
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  };

  const parsed = SetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    // The schema refines set message='weak' on password (missing letter/digit)
    // and 'mismatch' on confirm. Anything else (too short, missing) is a
    // generic invalid_input the form maps to the minLength translation.
    const weak = parsed.error.issues.some(
      (i) => i.path[0] === 'password' && i.message === 'weak',
    );
    if (weak) return { error: 'weak_password' };
    const mismatch = parsed.error.issues.some(
      (i) => i.path[0] === 'confirm' && i.message === 'mismatch',
    );
    return { error: mismatch ? 'mismatch' : 'invalid_input' };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { error: 'unauthorized' };

  // Throttle the post-invite credential window: a stolen one-time link
  // shouldn't grant an attacker unlimited password attempts. Legitimate
  // users click once. fail-closed because this is a security-critical gate.
  const ok = await checkRateLimit({
    action: 'set_password',
    subject: `user:${userRes.user.id}`,
    max: 5,
    windowSeconds: 3600,
    failMode: 'closed',
  });
  if (!ok) return { error: 'rate_limited' };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: 'unknown' };

  // SEC (R1-auth-2): a password change is the canonical "evict whoever else
  // holds my account" action — kill every OTHER session so a stolen or stale
  // session does not survive the reset. Keeps the current session alive.
  // Best-effort: a revoke hiccup must not fail the change that just succeeded.
  //
  // RESIDUAL WINDOW: revocation deletes the other sessions + refresh tokens,
  // so app access dies at the next request (middleware getUser() validates
  // the session server-side). But the stolen ACCESS JWT itself stays
  // cryptographically valid against the Supabase REST API until it expires —
  // up to jwt_expiry (1h). Shrinking that needs a shorter jwt_expiry and/or
  // secure_password_change=true in the PRODUCTION Supabase auth settings
  // (dashboard-managed; pending operator action, see Round-1 review).
  const { error: revokeErr } = await supabase.auth.signOut({ scope: 'others' });
  if (revokeErr) {
    console.error('[setPassword] revoking other sessions failed', {
      code: revokeErr.code ?? null,
    });
  }

  redirect('/cases');
}
