import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDriveClientIfConnected } from '@/features/integrations/services/drive-case-uploader';
import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { GET } from './route';

vi.mock('@/features/integrations/services/drive-case-uploader', () => ({
  getDriveClientIfConnected: vi.fn(),
}));
vi.mock('@/lib/auth/permissions', () => ({ userHasPermission: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

const DOCUMENT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

type TestDoc = {
  id: string;
  file_size: number | null;
  mime_type: string | null;
  drive_file_id: string | null;
  metadata: Record<string, unknown>;
};

const BASE_DOC: TestDoc = {
  id: DOCUMENT_ID,
  file_size: 11,
  mime_type: 'application/pdf',
  drive_file_id: null,
  metadata: { storage_path: `${DOCUMENT_ID}/document.pdf` },
};

type SetupOptions = {
  user?: { id: string } | null;
  doc?: TestDoc | null;
  docError?: unknown;
  storageBytes?: string | null;
  storageError?: unknown;
};

function setupSupabase({
  user = { id: USER_ID },
  doc = BASE_DOC,
  docError = null,
  storageBytes = 'storage-bytes',
  storageError = null,
}: SetupOptions = {}) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data: doc, error: docError })),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);

  // The route reads the object itself and answers from our own origin — a
  // redirect to supabase.co is what the office content filter blocked.
  const download = vi.fn(async () => ({
    data: storageBytes === null ? null : new Blob([storageBytes]),
    error: storageError,
  }));
  const storageFrom = vi.fn(() => ({ download }));
  const supabase = {
    auth: { getUser: vi.fn(async () => ({ data: { user } })) },
    from: vi.fn(() => query),
    storage: { from: storageFrom },
  };
  vi.mocked(createClient).mockResolvedValue(
    supabase as unknown as Awaited<ReturnType<typeof createClient>>,
  );

  return { download, query, storageFrom };
}

function callRouteJson(id = DOCUMENT_ID) {
  return GET(new Request(`http://localhost/api/documents/${id}/download?transport=json`), {
    params: Promise.resolve({ id }),
  });
}

function callRouteThumb(id = DOCUMENT_ID) {
  return GET(new Request(`http://localhost/api/documents/${id}/download?thumb=1`), {
    params: Promise.resolve({ id }),
  });
}

function callRoute(id = DOCUMENT_ID) {
  return GET(new Request(`http://localhost/api/documents/${id}/download`), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  vi.mocked(userHasPermission).mockResolvedValue(true);
  vi.mocked(getDriveClientIfConnected).mockResolvedValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('GET /api/documents/[id]/download', () => {
  it('rejects an invalid id before touching authentication', async () => {
    const response = await callRoute('not-a-uuid');

    expect(response.status).toBe(404);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('requires a signed-in user with document-view permission', async () => {
    setupSupabase({ user: null });
    expect((await callRoute()).status).toBe(401);
    expect(userHasPermission).not.toHaveBeenCalled();

    vi.clearAllMocks();
    setupSupabase();
    vi.mocked(userHasPermission).mockResolvedValue(false);
    expect((await callRoute()).status).toBe(403);
  });

  it('returns 404 when document RLS exposes no active row', async () => {
    setupSupabase({ doc: null });

    expect((await callRoute()).status).toBe(404);
  });

  it('serves the Drive pre-rendered thumbnail for ?thumb=1', async () => {
    const doc = { ...BASE_DOC, drive_file_id: 'drive-file-1' };
    setupSupabase({ doc });
    const getThumbnailLink = vi.fn(async () => 'https://lh3.example/thumb=s640');
    vi.mocked(getDriveClientIfConnected).mockResolvedValue({ getThumbnailLink } as never);
    const realFetch = global.fetch;
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).startsWith('https://lh3.example/')) {
          return new Response(new Uint8Array([1, 2, 3]) as unknown as BodyInit, { status: 200 });
        }
        return realFetch(input, init);
      });

    const response = await callRouteThumb();
    fetchSpy.mockRestore();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(getThumbnailLink).toHaveBeenCalledWith('drive-file-1');
  });

  it('falls back to full bytes when Drive has no thumbnail', async () => {
    const doc = { ...BASE_DOC, drive_file_id: 'drive-file-1' };
    setupSupabase({ doc });
    const getThumbnailLink = vi.fn(async () => null);
    vi.mocked(getDriveClientIfConnected).mockResolvedValue({ getThumbnailLink } as never);

    const response = await callRouteThumb();

    expect(response.status).toBe(200);
    // Storage bytes served as the document itself, not a thumbnail.
    await expect(response.text()).resolves.toBe('storage-bytes');
  });

  it('serves a Storage-backed document from our own origin', async () => {
    const doc = { ...BASE_DOC, drive_file_id: 'drive-copy-1' };
    const { download, storageFrom } = setupSupabase({ doc });

    const response = await callRoute();

    expect(response.status).toBe(200);
    expect(response.headers.get('Location')).toBeNull();
    expect(response.headers.get('Content-Disposition')).toBeNull();
    // Private + short-lived, not no-store: the folder grid re-requests the
    // same tile on every render, and the browser must be allowed to reuse it.
    expect(response.headers.get('Cache-Control')).toContain('private');
    expect(response.headers.get('Cache-Control')).toContain('max-age=300');
    await expect(response.text()).resolves.toBe('storage-bytes');
    expect(storageFrom).toHaveBeenCalledWith('case-documents');
    expect(download).toHaveBeenCalledWith(`${DOCUMENT_ID}/document.pdf`);
    expect(getDriveClientIfConnected).not.toHaveBeenCalled();
  });

  it('answers the json transport with base64 for the blocked-download path', async () => {
    setupSupabase({ doc: { ...BASE_DOC } });

    const response = await callRouteJson();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      base64: Buffer.from('storage-bytes').toString('base64'),
    });
  });

  it('streams a Drive-only file inline without an attachment header', async () => {
    const doc = { ...BASE_DOC, metadata: {}, drive_file_id: 'drive-file-1' };
    setupSupabase({ doc });
    const downloadFileResponse = vi.fn(
      async () =>
        new Response('drive-bytes', {
          headers: { 'Content-Type': 'application/pdf', 'Content-Length': '11' },
        }),
    );
    vi.mocked(getDriveClientIfConnected).mockResolvedValue({ downloadFileResponse } as never);

    const response = await callRoute();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Length')).toBe('11');
    expect(response.headers.get('Content-Disposition')).toBeNull();
    await expect(response.text()).resolves.toBe('drive-bytes');
    expect(downloadFileResponse).toHaveBeenCalledWith('drive-file-1');
  });

  it.each([
    [
      'document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'docx-export',
    ],
    [
      'spreadsheet',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xlsx-export',
    ],
    [
      'presentation',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'pptx-export',
    ],
    ['drawing', 'application/pdf', 'pdf-export'],
  ])(
    'exports a Google-native %s as its configured streamed format',
    async (googleType, targetMime, body) => {
      const doc = {
        ...BASE_DOC,
        metadata: {},
        drive_file_id: `google-${googleType}-1`,
        mime_type: `application/vnd.google-apps.${googleType}`,
        file_size: null,
      };
      setupSupabase({ doc });
      const exportFileResponse = vi.fn(async () => new Response(body));
      const downloadFileResponse = vi.fn();
      vi.mocked(getDriveClientIfConnected).mockResolvedValue({
        exportFileResponse,
        downloadFileResponse,
      } as never);

      const response = await callRoute();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe(targetMime);
      expect(response.headers.get('Content-Disposition')).toBeNull();
      await expect(response.text()).resolves.toBe(body);
      expect(exportFileResponse).toHaveBeenCalledWith(`google-${googleType}-1`, targetMime);
      expect(downloadFileResponse).not.toHaveBeenCalled();
    },
  );

  it('rejects an unsupported Google-native type without making a Drive request', async () => {
    const doc = {
      ...BASE_DOC,
      metadata: {},
      drive_file_id: 'google-form-1',
      mime_type: 'application/vnd.google-apps.form',
      file_size: null,
    };
    setupSupabase({ doc });

    const response = await callRoute();

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: 'unsupported' });
    expect(getDriveClientIfConnected).not.toHaveBeenCalled();
  });

  it('neutralizes an active-content MIME type supplied by Drive', async () => {
    const doc = {
      ...BASE_DOC,
      metadata: {},
      drive_file_id: 'html-file-1',
      mime_type: 'text/html',
    };
    setupSupabase({ doc });
    vi.mocked(getDriveClientIfConnected).mockResolvedValue({
      downloadFileResponse: vi.fn(async () => new Response('<script>alert(1)</script>')),
    } as never);

    const response = await callRoute();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    // The CSP for this path is set in next.config (a route handler's own
    // security headers are discarded by the config entry), so the handler
    // deliberately no longer emits one — nosniff plus the Content-Type
    // allowlist above are what neutralize the payload here.
    expect(response.headers.get('Content-Security-Policy')).toBeNull();
    expect(response.headers.get('Content-Disposition')).toBeNull();
  });

  it('falls back to Drive when reading the Storage object fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const doc = { ...BASE_DOC, drive_file_id: 'drive-file-1' };
    setupSupabase({ doc, storageBytes: null, storageError: { statusCode: 500 } });
    const downloadFileResponse = vi.fn(async () => new Response('fallback'));
    vi.mocked(getDriveClientIfConnected).mockResolvedValue({ downloadFileResponse } as never);

    const response = await callRoute();

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('fallback');
  });

  it('refuses a known oversized Drive file before opening the stream', async () => {
    const doc = {
      ...BASE_DOC,
      metadata: {},
      drive_file_id: 'drive-file-1',
      file_size: MAX_DOWNLOAD_BYTES + 1,
    };
    setupSupabase({ doc });

    expect((await callRoute()).status).toBe(413);
    expect(getDriveClientIfConnected).not.toHaveBeenCalled();
  });

  it('fails closed when the document lookup errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setupSupabase({ docError: { code: 'XX000', message: 'db unavailable' } });

    expect((await callRoute()).status).toBe(500);
  });
});
