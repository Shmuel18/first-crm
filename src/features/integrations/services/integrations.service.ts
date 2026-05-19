import { createClient } from '@/lib/supabase/server';

import type {
  DriveIntegrationView,
  IntegrationProvider,
  IntegrationRow,
  IntegrationStatus,
} from '../types';

export async function getIntegration(
  provider: IntegrationProvider,
): Promise<IntegrationRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('office_integrations')
    .select('*')
    .eq('provider', provider)
    .maybeSingle();

  if (error) throw error;
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
  if (input.refreshToken !== undefined) payload.refresh_token = input.refreshToken;
  if (input.accessToken !== undefined) payload.access_token = input.accessToken;
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
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { error } = await supabase
    .from('office_integrations')
    .update({ access_token: accessToken, token_expires_at: tokenExpiresAt })
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
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { error } = await supabase
    .from('office_integrations')
    .update({ drive_root_folder_id: folderId })
    .eq('provider', 'google_drive');
  if (error) throw error;
}
