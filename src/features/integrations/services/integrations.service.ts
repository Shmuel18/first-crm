import { decryptWithKey, encryptWithKey, encryptWithKeyV2 } from '@/lib/crypto/secrets';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import type {
  DriveIntegrationView,
  IntegrationProvider,
  IntegrationRow,
  IntegrationStatus,
} from '../types';

// OAuth tokens are encrypted at rest with INTEGRATION_ENCRYPTION_KEY (required
// at build time via env.ts). Writes prefer the v2 scheme (per-deployment salt
// from INTEGRATION_ENCRYPTION_SALT_V2) when that env var is set; otherwise
// they fall back to v1 (code-baked salt). The decrypt path is prefix-routed
// so v1 rows keep working alongside v2 rows during the rekey window.
function encryptToken<T extends string | null | undefined>(value: T): T {
  if (typeof value !== 'string') return value;
  if (env.INTEGRATION_ENCRYPTION_SALT_V2) {
    return encryptWithKeyV2(
      value,
      env.INTEGRATION_ENCRYPTION_KEY,
      env.INTEGRATION_ENCRYPTION_SALT_V2,
    ) as T;
  }
  return encryptWithKey(value, env.INTEGRATION_ENCRYPTION_KEY) as T;
}

function decryptToken<T extends string | null | undefined>(value: T): T {
  if (typeof value !== 'string') return value;
  return decryptWithKey(value, env.INTEGRATION_ENCRYPTION_KEY, {
    strict: env.INTEGRATION_ENCRYPTION_STRICT,
    saltV2: env.INTEGRATION_ENCRYPTION_SALT_V2,
  }) as T;
}

// office_integrations is admin-only under RLS, but Drive upload/sync are run by
// non-admin advisors (authorized upstream via userCanEditCase + upload
// permission). The office-wide OAuth token is server-only and never returned to
// the client, so token read/write during Drive flows uses the service-role
// client; otherwise a non-admin's request client silently no-ops (null reads,
// 0-row writes), breaking Drive for every advisor.
export async function getIntegration(
  provider: IntegrationProvider,
): Promise<IntegrationRow | null> {
  const supabase = createAdminClient();
  // select('*') is intentional here: getIntegration is the canonical
  // "give me the full row including encrypted token columns" entry point,
  // and decryptToken() below depends on access_token / refresh_token being
  // present. Adding a column to office_integrations should auto-include it
  // here — gating that propagation per-column would just create a stale
  // allowlist for the next schema bump.
  const { data, error } = await supabase
    .from('office_integrations')
    .select('*')
    .eq('provider', provider)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    data.refresh_token = decryptToken(data.refresh_token);
    data.access_token = decryptToken(data.access_token);
  }
  return data;
}

export async function getDriveIntegrationView(): Promise<DriveIntegrationView> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from('office_integrations')
    .select(
      'provider, status, connected_email, connected_at, scopes, last_error, drive_root_folder_id, drive_root_folder_name',
    )
    .eq('provider', 'google_drive')
    .maybeSingle();

  if (error) throw error;

  return {
    provider: 'google_drive',
    status: (row?.status as IntegrationStatus) ?? 'disconnected',
    connectedEmail: row?.connected_email ?? null,
    connectedAt: row?.connected_at ?? null,
    scopes: row?.scopes ?? [],
    lastError: row?.last_error ?? null,
    rootFolderId: row?.drive_root_folder_id ?? null,
    rootFolderName: row?.drive_root_folder_name ?? 'KFG_Cases',
  };
}

export type UpsertIntegrationInput = {
  provider: IntegrationProvider;
  status: IntegrationStatus;
  connectedEmail?: string | null;
  connectedExternalUserId?: string | null;
  refreshToken?: string | null;
  accessToken?: string | null;
  tokenExpiresAt?: string | null;
  scopes?: string[] | null;
  connectedBy?: string | null;
  connectedAt?: string | null;
  lastError?: string | null;
};

/**
 * Upsert an integration row. Only fields explicitly provided are written -
 * `undefined` values are SKIPPED so existing data isn't wiped.
 *
 * Callers can pass `null` explicitly to clear a field (e.g. lastError: null).
 * This matters for refresh_token: Google only returns it on first consent,
 * so a refresh flow must NOT call this with refreshToken=undefined.
 */
export async function upsertIntegration(input: UpsertIntegrationInput): Promise<void> {
  const supabase = await createClient();

  const payload: Record<string, unknown> = {
    provider: input.provider,
    status: input.status,
  };
  if (input.connectedEmail !== undefined) payload.connected_email = input.connectedEmail;
  if (input.connectedExternalUserId !== undefined)
    payload.connected_external_user_id = input.connectedExternalUserId;
  if (input.refreshToken !== undefined) payload.refresh_token = encryptToken(input.refreshToken);
  if (input.accessToken !== undefined) payload.access_token = encryptToken(input.accessToken);
  if (input.tokenExpiresAt !== undefined) payload.token_expires_at = input.tokenExpiresAt;
  if (input.scopes !== undefined) payload.scopes = input.scopes;
  if (input.connectedBy !== undefined) payload.connected_by = input.connectedBy;
  if (input.connectedAt !== undefined) payload.connected_at = input.connectedAt;
  if (input.lastError !== undefined) payload.last_error = input.lastError;

  const { error } = await supabase
    .from('office_integrations')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic payload built from optional inputs
    .upsert(payload as any, { onConflict: 'provider' });
  if (error) throw error;
}

export async function clearIntegration(provider: IntegrationProvider): Promise<void> {
  // office_integrations is admin-only under RLS; the disconnect action gates
  // on isAdmin upfront, but using the cookie-bound client here would still
  // silently 0-row if the gate ever drifted. Match getIntegration and the
  // other writers in this file and use the service-role client.
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('office_integrations')
    .update({
      status: 'disconnected',
      connected_email: null,
      connected_external_user_id: null,
      refresh_token: null,
      access_token: null,
      token_expires_at: null,
      scopes: null,
      connected_by: null,
      connected_at: null,
      last_error: null,
    })
    .eq('provider', provider);
  if (error) throw error;
}

/** Persist a freshly refreshed access token without touching other fields. */
export async function persistRefreshedAccessToken(
  provider: IntegrationProvider,
  accessToken: string,
  tokenExpiresAt: string,
): Promise<void> {
  // Service-role: runs inside a non-admin advisor's Drive flow (see getIntegration).
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('office_integrations')
    .update({ access_token: encryptToken(accessToken), token_expires_at: tokenExpiresAt })
    .eq('provider', provider);
  if (error) throw error;
}

/**
 * Flip an integration to status='error' after a permanent OAuth failure
 * (e.g., refresh token revoked, scope withdrawn). Clears the access token
 * so subsequent calls don't try to use a stale one, stamps last_error so
 * Settings UI can surface "reconnect required".
 */
export async function markIntegrationDisconnected(
  provider: IntegrationProvider,
  reason: string,
): Promise<void> {
  // Service-role: runs inside a non-admin advisor's Drive flow (see getIntegration).
  const supabase = createAdminClient();
  await supabase
    .from('office_integrations')
    .update({
      status: 'error',
      access_token: null,
      token_expires_at: null,
      last_error: reason,
    })
    .eq('provider', provider);
}

/** Persist the root Drive folder ID (lazy-created on first upload). */
export async function persistDriveRootFolderId(folderId: string): Promise<void> {
  // Service-role: lazy folder creation happens during a non-admin advisor's
  // first upload (see getIntegration).
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('office_integrations')
    .update({ drive_root_folder_id: folderId })
    .eq('provider', 'google_drive');
  if (error) throw error;
}
