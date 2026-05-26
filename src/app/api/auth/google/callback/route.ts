import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { env, isGoogleOAuthConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

/** OAuth callback does a token exchange + userinfo fetch + an integrations
 *  upsert. 30 s is plenty; capping it prevents a slow Google hop from holding
 *  the function until the platform default kills it. */
export const maxDuration = 30;

import {
  exchangeCodeForTokens,
  fetchUserInfo,
} from '@/features/integrations/services/google-oauth';
import {
  getIntegration,
  upsertIntegration,
} from '@/features/integrations/services/integrations.service';

const OAUTH_STATE_COOKIE = 'google_oauth_state';

function redirectWithError(reason: string): Response {
  return NextResponse.redirect(
    `${env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=${encodeURIComponent(reason)}`,
  );
}

function isAllowedGoogleAccount(_email: string, hostedDomain?: string): boolean {
  const allowed = env.GOOGLE_OAUTH_ALLOWED_DOMAIN;
  if (!allowed) return true;

  const allowedDomains = allowed
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  if (allowedDomains.length === 0) return true;

  // hd-only match: the `hd` ("hosted domain") claim is only set by Google
  // for Workspace accounts and reflects the verified ownership of the
  // domain by an admin. The email LOCAL part is user-controlled (anyone
  // can create an alias) and email DOMAIN equality is meaningless for
  // non-Workspace accounts — Google won't enforce that gmail.com user's
  // email "foo@kaufman.co.il" actually belongs to the kaufman.co.il
  // domain. The original "hd OR emailDomain" check would let such an
  // account through. Reject any account without a matching hd.
  if (!hostedDomain) return false;
  return allowedDomains.includes(hostedDomain.toLowerCase());
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

    // Google's consent screen lets users grant a partial subset of the
    // requested scopes. If they deny the Drive scope, we'd happily store
    // an "authenticated" row whose every Drive API call 403s. Verify here
    // and fail loudly instead.
    const grantedScopes = tokens.scope.split(' ');
    if (!grantedScopes.includes('https://www.googleapis.com/auth/drive')) {
      return redirectWithError('drive_scope_missing');
    }

    const userInfo = await fetchUserInfo(tokens.access_token);
    if (!isAllowedGoogleAccount(userInfo.email, userInfo.hd)) {
      return redirectWithError('google_account_not_allowed');
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Google only returns refresh_token on first consent. On re-consent it
    // may be omitted - in that case keep the previously stored one (if any)
    // so refresh keeps working. Only overwrite when we got a fresh one.
    const existing = await getIntegration('google_drive');
    const refreshToken = tokens.refresh_token ?? existing?.refresh_token ?? null;

    await upsertIntegration({
      provider: 'google_drive',
      status: 'connected',
      connectedEmail: userInfo.email,
      connectedExternalUserId: userInfo.sub,
      refreshToken,
      accessToken: tokens.access_token,
      tokenExpiresAt: expiresAt,
      scopes: grantedScopes,
      connectedBy: userRes.user.id,
      connectedAt: new Date().toISOString(),
      lastError: null,
    });
  } catch (err) {
    console.error('Google Drive OAuth callback failed', { err });
    return redirectWithError('connect_failed');
  }

  return NextResponse.redirect(
    `${env.NEXT_PUBLIC_APP_URL}/settings/integrations?connected=google_drive`,
  );
}
