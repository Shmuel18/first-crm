import { NextResponse } from 'next/server';

import { autoClockInIfEnabled } from '@/features/time-clock/services/auto-clock-in';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

/**
 * Supabase auth callback for magic links (invite, recovery, magic-link).
 *
 * Supabase appends `?code=<pkce_code>` (and `type=invite|recovery|magiclink`)
 * to the redirect URL we hand it in `admin.generateLink`. We exchange the code
 * for a session here (which writes the auth cookies) and then forward the user
 * to `next` if supplied, or `/cases` as a default.
 *
 * `next` is attacker-controllable via the URL, so it MUST be a same-origin
 * path. Any value that doesn't start with a single `/` is rejected and we
 * fall back to the default.
 */
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
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next');

  const next =
    typeof nextParam === 'string' && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/cases';

  if (!code) {
    return redirectNoStore(`${env.NEXT_PUBLIC_APP_URL}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data: authData, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Invalid / expired / already-used token. The login page surfaces the
    // error code as a translated message.
    return redirectNoStore(`${env.NEXT_PUBLIC_APP_URL}/login?error=invalid_invite`);
  }

  // Opt-in auto punch-in for hourly staff (best-effort; never blocks the flow).
  await autoClockInIfEnabled(supabase, authData.user?.id);

  return redirectNoStore(`${env.NEXT_PUBLIC_APP_URL}${next}`);
}
