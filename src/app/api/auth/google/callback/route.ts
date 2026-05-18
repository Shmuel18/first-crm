import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { env, isGoogleOAuthConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

import {
  exchangeCodeForTokens,
  fetchUserInfo,
} from '@/features/integrations/services/google-oauth';
import { upsertIntegration } from '@/features/integrations/services/integrations.service';

const OAUTH_STATE_COOKIE = 'google_oauth_state';

function redirectWithError(reason: string): Response {
  return NextResponse.redirect(
    `${env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=${encodeURIComponent(reason)}`,
  );
}

export async function GET(request: Request): Promise<Response> {
  if (!isGoogleOAuthConfigured()) {
    return redirectWithError('oauth_not_configured');
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const userDeniedError = url.searchParams.get('error');

  if (userDeniedError) return redirectWithError(userDeniedError);
  if (!code || !state) return redirectWithError('missing_params');

  const cookieStore = await cookies();
  const cookieState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);
  if (!cookieState || cookieState !== state) {
    return redirectWithError('state_mismatch');
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/login`);

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) return redirectWithError('admin_only');

  try {
    const tokens = await exchangeCodeForTokens(code);
    const userInfo = await fetchUserInfo(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await upsertIntegration({
      provider: 'google_drive',
      status: 'connected',
      connectedEmail: userInfo.email,
      connectedExternalUserId: userInfo.sub,
      refreshToken: tokens.refresh_token ?? null,
      accessToken: tokens.access_token,
      tokenExpiresAt: expiresAt,
      scopes: tokens.scope.split(' '),
      connectedBy: userRes.user.id,
      connectedAt: new Date().toISOString(),
      lastError: null,
    });
  } catch (err) {
    return redirectWithError(err instanceof Error ? err.message : 'connect_failed');
  }

  return NextResponse.redirect(
    `${env.NEXT_PUBLIC_APP_URL}/settings/integrations?connected=google_drive`,
  );
}
