import { NextResponse } from 'next/server';

import type { EmailOtpType } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

/**
 * Email-link verification via the token_hash flow (invite / recovery / magic
 * link). This is the SSR-correct path: it works on a server route with no PKCE
 * code_verifier and no URL hash.
 *
 * Why not /auth/callback: an admin-generated `action_link` resolves through
 * Supabase's /verify endpoint, which returns the session in the URL *hash*
 * (`#access_token=...`, the implicit flow). A server route can't read the hash,
 * so exchangeCodeForSession never sees a `code` → "missing_code". Instead we
 * hand out a link to THIS route carrying `?token_hash=...&type=...`, and verify
 * it server-side here (verifyOtp writes the auth cookies), then forward to
 * `next` (e.g. /auth/set-password).
 *
 * `next` is attacker-controllable, so it MUST be a same-origin path — anything
 * not starting with a single `/` falls back to the default.
 */
// Least-privilege: ONLY the OTP types this app actually mints (invite via
// invite-member, recovery via request-password-reset, magiclink via
// resend-invite). Re-add a type only together with the flow that issues it.
const ALLOWED_TYPES = [
  'invite',
  'recovery',
  'magiclink',
] as const satisfies readonly EmailOtpType[];

/**
 * Redirect that explicitly refuses caching. These responses can carry the
 * freshly-written auth cookies (Set-Cookie on a 3xx); the framework/host
 * defaults already avoid caching them, but an explicit no-store removes the
 * dependency on that behavior (e.g. behind a non-Vercel proxy).
 */
function redirectNoStore(url: string): NextResponse {
  const res = NextResponse.redirect(url);
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const typeParam = url.searchParams.get('type');
  const type = ALLOWED_TYPES.find((t) => t === typeParam);
  const nextParam = url.searchParams.get('next');

  const next =
    typeof nextParam === 'string' && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/cases';

  if (!tokenHash || !type) {
    return redirectNoStore(`${env.NEXT_PUBLIC_APP_URL}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    // Invalid / expired / already-used token. The login page surfaces the
    // error code as a translated message.
    return redirectNoStore(`${env.NEXT_PUBLIC_APP_URL}/login?error=invalid_invite`);
  }

  return redirectNoStore(`${env.NEXT_PUBLIC_APP_URL}${next}`);
}
