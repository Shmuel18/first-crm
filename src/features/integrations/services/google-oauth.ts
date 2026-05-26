import { env } from '@/lib/env';
import { timeoutSignal } from '@/lib/http/with-timeout';

/**
 * Google OAuth 2.0 helpers (server-only).
 *
 * Scope: `drive` (FULL Drive access) — REQUIRED for bidirectional sync because
 * the office wants files dropped manually into Drive to surface in the app.
 * `drive.file` would only see files we created, breaking that use case.
 *
 * Google classifies `drive` as a "restricted" scope. Implication:
 *   - In Testing mode (current setup): up to 100 test users, each must be
 *     added to the OAuth consent screen as a Test user. Users see an
 *     "unverified app" warning but can proceed via Advanced > Continue.
 *     No verification required.
 *   - For Production (public app): Google requires a CASA Tier 2 security
 *     assessment ($15k-75k, 4-6 weeks).
 *   - Alternative for one office: a Google Workspace "Internal" app
 *     (kaufman.co.il Workspace) avoids the warning AND verification.
 *
 * For Kaufman's office (~10 users) staying in Testing mode is the path.
 */

export const GOOGLE_DRIVE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/drive',
] as const;

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export function buildAuthUrl(state: string): string {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_REDIRECT_URI) {
    throw new Error('Google OAuth not configured');
  }
  const params = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: GOOGLE_DRIVE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
    include_granted_scopes: 'true',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
};

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  if (
    !env.GOOGLE_OAUTH_CLIENT_ID ||
    !env.GOOGLE_OAUTH_CLIENT_SECRET ||
    !env.GOOGLE_OAUTH_REDIRECT_URI
  ) {
    throw new Error('Google OAuth not configured');
  }
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: timeoutSignal(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

/**
 * Thrown by refreshAccessToken when Google rejects the refresh request.
 * `permanent === true` for errors that won't recover by retrying
 * (invalid_grant: refresh token revoked or expired; invalid_client: app
 * credentials wrong). Callers should flip the integration to status='error'
 * and require the admin to reconnect.
 */
export class RefreshTokenError extends Error {
  readonly permanent: boolean;
  constructor(message: string, permanent: boolean) {
    super(message);
    this.name = 'RefreshTokenError';
    this.permanent = permanent;
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error('Google OAuth not configured');
  }
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: timeoutSignal(),
  });

  if (!res.ok) {
    const text = await res.text();
    // Classify permanent failures so the caller can flip integration state
    // to 'error' and require the admin to reconnect.
    const permanent = /invalid_grant|invalid_client|invalid_scope/i.test(text);
    throw new RefreshTokenError(
      `Google token refresh failed: ${res.status} ${text}`,
      permanent,
    );
  }
  return (await res.json()) as TokenResponse;
}

export async function fetchUserInfo(
  accessToken: string,
): Promise<{ email: string; sub: string; hd?: string }> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: timeoutSignal(),
  });
  if (!res.ok) throw new Error('Failed to fetch Google user info');
  const data = (await res.json()) as { email: string; sub: string; hd?: string };
  return { email: data.email, sub: data.sub, hd: data.hd };
}

/**
 * Revoke a Google OAuth token. Never throws - the local disconnect should
 * proceed even if Google is unreachable - but logs warnings so a stuck
 * revoke is visible in server logs.
 */
export async function revokeToken(token: string): Promise<void> {
  try {
    const res = await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      signal: timeoutSignal(),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`Google token revoke failed: ${res.status} ${res.statusText} ${body}`);
    }
  } catch (err) {
    console.warn('Google token revoke threw:', err);
  }
}
