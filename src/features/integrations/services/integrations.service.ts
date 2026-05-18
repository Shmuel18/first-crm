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
  const row = await getIntegration('google_drive');

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

export async function upsertIntegration(input: UpsertIntegrationInput): Promise<void> {
  const supabase = await createClient();
  const payload = {
    provider: input.provider,
    status: input.status,
    connected_email: input.connectedEmail ?? null,
    connected_external_user_id: input.connectedExternalUserId ?? null,
    refresh_token: input.refreshToken ?? null,
    access_token: input.accessToken ?? null,
    token_expires_at: input.tokenExpiresAt ?? null,
    scopes: input.scopes ?? null,
    connected_by: input.connectedBy ?? null,
    connected_at: input.connectedAt ?? null,
    last_error: input.lastError ?? null,
  };
  const { error } = await supabase
    .from('office_integrations')
    .upsert(payload, { onConflict: 'provider' });
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

/** Persist the root Drive folder ID (lazy-created on first upload). */
export async function persistDriveRootFolderId(folderId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('office_integrations')
    .update({ drive_root_folder_id: folderId })
    .eq('provider', 'google_drive');
  if (error) throw error;
}
