import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { env, isGoogleOAuthConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

import { buildAuthUrl } from '@/features/integrations/services/google-oauth';

const OAUTH_STATE_COOKIE = 'google_oauth_state';

export async function GET(): Promise<Response> {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(
      `${env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=oauth_not_configured`,
    );
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/login`);
  }

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    return NextResponse.redirect(
      `${env.NEXT_PUBLIC_APP_URL}/settings?error=admin_only`,
    );
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  });

  const url = buildAuthUrl(state);
  return NextResponse.redirect(url);
}
