import 'server-only';

import { timeoutSignal } from '@/lib/http/with-timeout';

import type { GmailPart } from '../domain/gmail-parsing';
import type { IntegrationProvider, IntegrationRow } from '../types';

import { GMAIL_SCOPE, refreshAccessToken, RefreshTokenError } from './google-oauth';
import {
  getIntegration,
  markIntegrationDisconnected,
  persistRefreshedAccessToken,
} from './integrations.service';

/**
 * Minimal READ-ONLY Gmail client for the mail-triage engine (ai-v2-spec §3.1).
 * Rides the SAME office Google integration row as Drive (one OAuth grant).
 * Token handling mirrors GoogleDriveClient: refresh-once-in-flight, persist
 * the refreshed token, flip the integration to error on permanent failures.
 *
 * Deliberately absent: send / modify / delete / label — the engine never
 * touches the mailbox; processed-tracking lives in email_inbox.
 */

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

export type GmailMessageRef = { id: string; threadId?: string };

export type GmailFullMessage = {
  id: string;
  threadId?: string;
  internalDate?: string;
  payload?: GmailPart;
};

export class GmailClient {
  private accessToken: string | null;
  private tokenExpiresAt: number;
  private refreshPromise: Promise<string> | null = null;

  constructor(private integration: IntegrationRow) {
    this.accessToken = integration.access_token;
    this.tokenExpiresAt = integration.token_expires_at
      ? new Date(integration.token_expires_at).getTime()
      : 0;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt > Date.now() + 60_000) {
      return this.accessToken;
    }
    if (!this.integration.refresh_token) throw new Error('No refresh token on integration');
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const tokens = await refreshAccessToken(this.integration.refresh_token!);
        this.accessToken = tokens.access_token;
        this.tokenExpiresAt = Date.now() + tokens.expires_in * 1000;
        await persistRefreshedAccessToken(
          this.integration.provider as IntegrationProvider,
          this.accessToken,
          new Date(this.tokenExpiresAt).toISOString(),
        );
        return this.accessToken;
      } catch (err) {
        if (err instanceof RefreshTokenError && err.permanent) {
          await markIntegrationDisconnected(
            this.integration.provider as IntegrationProvider,
            err.message,
          ).catch((markErr) => console.error('failed to mark integration disconnected', markErr));
        }
        throw err;
      }
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async getJson<T>(path: string): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`${GMAIL_API}${path}`, {
      signal: timeoutSignal(),
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`gmail ${path.split('?')[0]} failed: ${res.status} ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  /** Newest-first message refs matching the query (default: recent inbox). */
  async listInboxMessages(opts: { query: string; maxResults: number }): Promise<GmailMessageRef[]> {
    const params = new URLSearchParams({
      q: opts.query,
      maxResults: String(opts.maxResults),
    });
    const data = await this.getJson<{ messages?: GmailMessageRef[] }>(`/messages?${params}`);
    return data.messages ?? [];
  }

  async getMessage(id: string): Promise<GmailFullMessage> {
    return this.getJson<GmailFullMessage>(`/messages/${encodeURIComponent(id)}?format=full`);
  }

  /** Attachment bytes (Gmail returns base64url). */
  async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    const data = await this.getJson<{ data?: string }>(
      `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    );
    if (!data.data) throw new Error('gmail attachment: empty payload');
    return Buffer.from(data.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  }
}

export type GmailConnection =
  | { ok: true; client: GmailClient }
  | { ok: false; reason: 'not_connected' | 'scope_missing' };

/**
 * The office Google integration, if usable for Gmail. `scope_missing` means
 * the admin connected BEFORE the Gmail scope was added — Drive keeps working,
 * mail intake waits for a one-click reconnect (ai-v2-spec §3.1).
 */
export async function getGmailConnection(): Promise<GmailConnection> {
  const row = await getIntegration('google_drive');
  if (!row || row.status !== 'connected' || !row.refresh_token) {
    return { ok: false, reason: 'not_connected' };
  }
  if (!row.scopes || !row.scopes.includes(GMAIL_SCOPE)) {
    return { ok: false, reason: 'scope_missing' };
  }
  return { ok: true, client: new GmailClient(row) };
}
