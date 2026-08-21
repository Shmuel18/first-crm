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
  signedUrl?: string | null;
  signedUrlError?: unknown;
};

function setupSupabase({
  user = { id: USER_ID },
  doc = BASE_DOC,
  docError = null,
  signedUrl = 'https://storage.example/signed',
  signedUrlError = null,
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

  const createSignedUrl = vi.fn(async () => ({
    data: signedUrl ? { signedUrl } : null,
    error: signedUrlError,
  }));
  const storageFrom = vi.fn(() => ({ createSignedUrl }));
  const supabase = {
    auth: { getUser: vi.fn(async () => ({ data: { user } })) },
    from: vi.fn(() => query),
    storage: { from: storageFrom },
  };
  vi.mocked(createClient).mockResolvedValue(
    supabase as unknown as Awaited<ReturnType<typeof createClient>>,
  );

  return { createSignedUrl, query, storageFrom };
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

  it('redirects a Storage-backed document to a short-lived signed URL', async () => {
    const doc = { ...BASE_DOC, drive_file_id: 'drive-copy-1' };
    const { createSignedUrl, storageFrom } = setupSupabase({ doc });

    const response = await callRoute();

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('https://storage.example/signed');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(storageFrom).toHaveBeenCalledWith('case-documents');
    expect(createSignedUrl).toHaveBeenCalledWith(`${DOCUMENT_ID}/document.pdf`, 60);
    expect(getDriveClientIfConnected).not.toHaveBeenCalled();
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

  it('exports a Google-native document as a streamed PDF', async () => {
    const doc = {
      ...BASE_DOC,
      metadata: {},
      drive_file_id: 'google-doc-1',
      mime_type: 'application/vnd.google-apps.document',
      file_size: null,
    };
    setupSupabase({ doc });
    const exportFileAsPdfResponse = vi.fn(async () => new Response('pdf-export'));
    const downloadFileResponse = vi.fn();
    vi.mocked(getDriveClientIfConnected).mockResolvedValue({
      exportFileAsPdfResponse,
      downloadFileResponse,
    } as never);

    const response = await callRoute();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    await expect(response.text()).resolves.toBe('pdf-export');
    expect(exportFileAsPdfResponse).toHaveBeenCalledWith('google-doc-1');
    expect(downloadFileResponse).not.toHaveBeenCalled();
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
    expect(response.headers.get('Content-Security-Policy')).toBe("sandbox; default-src 'none'");
    expect(response.headers.get('Content-Disposition')).toBeNull();
  });

  it('falls back to Drive when signing the Storage path fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const doc = { ...BASE_DOC, drive_file_id: 'drive-file-1' };
    setupSupabase({ doc, signedUrl: null, signedUrlError: { statusCode: 500 } });
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
