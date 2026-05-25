import { NextResponse } from 'next/server';

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
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next');

  const next =
    typeof nextParam === 'string' && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/cases';

  if (!code) {
    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Invalid / expired / already-used token. The login page surfaces the
    // error code as a translated message.
    return NextResponse.redirect(
      `${env.NEXT_PUBLIC_APP_URL}/login?error=invalid_invite`,
    );
  }

  return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}${next}`);
}
