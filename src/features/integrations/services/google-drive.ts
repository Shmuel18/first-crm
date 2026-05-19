import type { IntegrationProvider, IntegrationRow } from '../types';
import { refreshAccessToken, RefreshTokenError } from './google-oauth';
import {
  markIntegrationDisconnected,
  persistRefreshedAccessToken,
} from './integrations.service';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export type DriveUploadResult = {
  id: string;
  webViewLink: string;
};

export class GoogleDriveClient {
  private accessToken: string | null;
  private tokenExpiresAt: number;
  // Singleton in-flight refresh so concurrent callers don't double-refresh
  // and race to overwrite each other's persisted token.
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
    if (!this.integration.refresh_token) {
      throw new Error('No refresh token on integration');
    }
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
        // Permanent failure (invalid_grant etc.): admin must reconnect.
        // Flip integration to status='error' so the UI shows it and we
        // stop attempting silent refreshes on every request.
        if (err instanceof RefreshTokenError && err.permanent) {
          await markIntegrationDisconnected(
            this.integration.provider as IntegrationProvider,
            err.message,
          ).catch((markErr) =>
            console.error('failed to mark integration disconnected', markErr),
          );
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

  private async authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.getAccessToken();
    return fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });
  }

  /**
   * Retry transient Drive failures (429 rate limit, 5xx server errors) with
   * exponential backoff. Honors Retry-After header when present. Read-only
   * methods (GET) opt in; mutations bypass retry to stay idempotent.
   */
  private async authedFetchRetry(url: string, init: RequestInit = {}, retries = 2): Promise<Response> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await this.authedFetch(url, init);
      const transient = res.status === 429 || res.status === 502 || res.status === 503;
      if (!transient || attempt === retries) return res;
      const retryAfter = res.headers.get('Retry-After');
      const delayMs = retryAfter
        ? Math.min(Number(retryAfter) * 1000, 10_000)
        : Math.min(500 * 2 ** attempt, 4_000);
      await new Promise((r) => setTimeout(r, delayMs));
    }
    // Unreachable - the loop returns or throws - but TS doesn't infer it.
    return this.authedFetch(url, init);
  }

  async findFolder(name: string, parentId?: string): Promise<string | null> {
    // Escape backslashes first, then single quotes. Order matters - escaping
    // quotes first would mangle the backslash we add.
    const escaped = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const parts = [
      `name = '${escaped}'`,
      `mimeType = '${FOLDER_MIME}'`,
      `trashed = false`,
    ];
    if (parentId) parts.push(`'${parentId}' in parents`);
    const q = parts.join(' and ');
    const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1&spaces=drive`;
    const res = await this.authedFetchRetry(url);
    if (!res.ok) throw new Error(`Drive folder search failed: ${res.status}`);
    const data = (await res.json()) as { files: { id: string; name: string }[] };
    return data.files[0]?.id ?? null;
  }

  async createFolder(
    name: string,
    parentId?: string,
    appProperties?: Record<string, string>,
  ): Promise<string> {
    const body: Record<string, unknown> = { name, mimeType: FOLDER_MIME };
    if (parentId) body.parents = [parentId];
    if (appProperties) body.appProperties = appProperties;
    const res = await this.authedFetch(`${DRIVE_API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Drive folder create failed: ${res.status}`);
    const data = (await res.json()) as { id: string };
    return data.id;
  }

  async ensureFolder(name: string, parentId?: string): Promise<string> {
    const existing = await this.findFolder(name, parentId);
    if (existing) return existing;
    return this.createFolder(name, parentId);
  }

  /**
   * Find a folder by an appProperty key/value pair. More reliable than
   * name-based lookup: rename / reorganize on Drive doesn't break us, and
   * the lookup matches a stable id we control.
   */
  async findFolderByAppProperty(
    key: string,
    value: string,
    parentId?: string,
  ): Promise<string | null> {
    // Escape single quotes inside value for the Drive query DSL.
    const safeValue = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const parts = [
      `mimeType = '${FOLDER_MIME}'`,
      `trashed = false`,
      `appProperties has { key='${key}' and value='${safeValue}' }`,
    ];
    if (parentId) parts.push(`'${parentId}' in parents`);
    const q = parts.join(' and ');
    const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1&spaces=drive`;
    const res = await this.authedFetchRetry(url);
    if (!res.ok) throw new Error(`Drive appProperty lookup failed: ${res.status}`);
    const data = (await res.json()) as { files: { id: string; name: string }[] };
    return data.files[0]?.id ?? null;
  }

  async uploadFile(file: {
    content: ArrayBuffer | Uint8Array;
    name: string;
    mimeType: string;
    parentId: string;
  }): Promise<DriveUploadResult> {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const metadata = { name: file.name, parents: [file.parentId] };

    const head = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: ${file.mimeType}\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const bytes =
      file.content instanceof Uint8Array ? file.content : new Uint8Array(file.content);
    const fileBuf = Buffer.from(bytes);
    const body = Buffer.concat([head, fileBuf, tail]);

    const res = await this.authedFetch(
      `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,webViewLink`,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: new Uint8Array(body),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Drive upload failed: ${res.status} ${text}`);
    }
    const data = (await res.json()) as { id: string; webViewLink: string };
    return data;
  }

  async deleteFile(fileId: string): Promise<void> {
    const res = await this.authedFetch(`${DRIVE_API}/files/${fileId}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Drive delete failed: ${res.status}`);
    }
  }

  async listFolderFiles(folderId: string): Promise<DriveFileMeta[]> {
    const q = `'${folderId}' in parents and trashed = false and mimeType != '${FOLDER_MIME}'`;
    const fields = 'files(id,name,mimeType,size,webViewLink,modifiedTime,createdTime)';
    const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=200&spaces=drive`;
    const res = await this.authedFetchRetry(url);
    if (!res.ok) throw new Error(`Drive list folder failed: ${res.status}`);
    const data = (await res.json()) as { files: DriveFileMeta[] };
    return data.files ?? [];
  }

  /**
   * Paginated variant - follows nextPageToken until exhausted. Use this
   * (not listFolderFiles) whenever the absence of a file would be
   * interpreted as "deleted" - otherwise everything past file #200 would
   * appear gone and be wiped from our records.
   */
  async listFolderFilesPaginated(folderId: string): Promise<DriveFileMeta[]> {
    const q = `'${folderId}' in parents and trashed = false and mimeType != '${FOLDER_MIME}'`;
    const fields =
      'nextPageToken,files(id,name,mimeType,size,webViewLink,modifiedTime,createdTime)';
    const out: DriveFileMeta[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        q,
        fields,
        pageSize: '1000',
        spaces: 'drive',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const res = await this.authedFetchRetry(`${DRIVE_API}/files?${params.toString()}`);
      if (!res.ok) throw new Error(`Drive list folder failed: ${res.status}`);
      const data = (await res.json()) as {
        files: DriveFileMeta[];
        nextPageToken?: string;
      };
      if (data.files) out.push(...data.files);
      pageToken = data.nextPageToken;
    } while (pageToken);
    return out;
  }

  async listSubfolders(parentId: string): Promise<{ id: string; name: string }[]> {
    const q = `'${parentId}' in parents and trashed = false and mimeType = '${FOLDER_MIME}'`;
    const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=200&spaces=drive`;
    const res = await this.authedFetchRetry(url);
    if (!res.ok) throw new Error(`Drive list subfolders failed: ${res.status}`);
    const data = (await res.json()) as { files: { id: string; name: string }[] };
    return data.files ?? [];
  }
}

export type DriveFileMeta = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink: string;
  modifiedTime: string;
  createdTime: string;
};

/** Hebrew folder names per spec (KFG_Cases/{case}/01_זהות_וקשר/...). */
export const DRIVE_SUBFOLDER_NAMES: Record<string, string> = {
  identity: '01_זהות_וקשר',
  income_il: '02_תעסוקה_והכנסות',
  income_abroad: '03_הכנסות_מחול',
  insurance_collateral: '04_אישורים_וביטחונות',
};

export function caseFolderName(caseNumber: string, familyName: string): string {
  const safe = familyName.replace(/[\\/:*?"<>|]/g, '').trim() || 'Case';
  return `${caseNumber}_${safe}`;
}
