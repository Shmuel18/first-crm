import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchPdfBytes, resetPdfTransportLatch } from './pdf-bytes';

const PDF = new TextEncoder().encode('%PDF-1.4\nreal document bytes');
const BLOCK_PAGE = new TextEncoder().encode('<html><body>403 Forbidden</body></html>');

function binaryResponse(body: Uint8Array, status = 200): Response {
  return new Response(body as unknown as BodyInit, { status });
}

function jsonEnvelope(bytes: Uint8Array): Response {
  const base64 = Buffer.from(bytes).toString('base64');
  return Response.json({ ok: true, base64, filename: 'x.pdf', mimeType: 'application/pdf' });
}

/** document.baseURI is needed to build the ?transport=json URL. */
function stubWindow(): void {
  vi.stubGlobal('document', { baseURI: 'https://app.test/cases/1/documents' });
  vi.stubGlobal('atob', (s: string) => Buffer.from(s, 'base64').toString('binary'));
  // The binary-blocked latch is module state: a test that exercises the
  // fallback would otherwise make every later test skip the binary attempt.
  resetPdfTransportLatch();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchPdfBytes', () => {
  it('uses the raw bytes when the response really is a PDF', async () => {
    stubWindow();
    const fetchMock = vi.fn(async () => binaryResponse(PDF));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPdfBytes('/api/documents/x/download');

    expect(result).toMatchObject({ ok: true, transport: 'binary' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the json envelope when a filter answers with its own page', async () => {
    stubWindow();
    // The office content filter replies 200 with HTML in place of the file.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(binaryResponse(BLOCK_PAGE))
      .mockResolvedValueOnce(jsonEnvelope(PDF));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPdfBytes('/api/documents/x/download');

    expect(result).toMatchObject({ ok: true, transport: 'json' });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('transport=json');
  });

  it('falls back to the json envelope on the filter’s fake 403', async () => {
    stubWindow();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(binaryResponse(BLOCK_PAGE, 403))
      .mockResolvedValueOnce(jsonEnvelope(PDF));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPdfBytes('/api/documents/x/download')).resolves.toMatchObject({
      ok: true,
      transport: 'json',
    });
  });

  it('reports unauthorized when both transports are refused', async () => {
    stubWindow();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(binaryResponse(BLOCK_PAGE, 401))
      .mockResolvedValueOnce(new Response('nope', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPdfBytes('/api/documents/x/download')).resolves.toMatchObject({
      ok: false,
      reason: 'unauthorized',
    });
  });

  it('accepts a PDF that does not start at byte 0', async () => {
    stubWindow();
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...PDF]);
    vi.stubGlobal('fetch', vi.fn(async () => binaryResponse(withBom)));

    const result = await fetchPdfBytes('/api/documents/x/download');

    expect(result.ok).toBe(true);
    // The leading junk is trimmed so pdf.js gets a buffer starting at %PDF-.
    if (result.ok) expect(result.bytes[0]).toBe(0x25);
  });

  it('treats a truncated body as blocked even though the header said 200', async () => {
    stubWindow();
    const short = new Response(PDF as unknown as BodyInit, {
      status: 200,
      // A rewriting proxy can leave a length describing more than arrived.
      headers: { 'content-length': String(PDF.byteLength + 500) },
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(short).mockResolvedValueOnce(jsonEnvelope(PDF));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPdfBytes('/api/documents/x/download')).resolves.toMatchObject({
      ok: true,
      transport: 'json',
    });
  });

  it('carries per-attempt evidence on failure', async () => {
    stubWindow();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(binaryResponse(BLOCK_PAGE))
      .mockResolvedValueOnce(new Response('no', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPdfBytes('/api/documents/x/download');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.attempts).toHaveLength(2);
      expect(result.attempts[0]).toMatchObject({ transport: 'binary', status: 200 });
      expect(result.attempts[0]?.head).toMatch(/^3c68746d6c/); // "<html"
      expect(result.attempts[1]).toMatchObject({ transport: 'json', status: 500 });
    }
  });

  it('skips the binary attempt once the transport is known to be blocked', async () => {
    stubWindow();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(binaryResponse(BLOCK_PAGE))
      .mockResolvedValueOnce(jsonEnvelope(PDF))
      .mockResolvedValueOnce(jsonEnvelope(PDF));
    vi.stubGlobal('fetch', fetchMock);

    await fetchPdfBytes('/api/documents/a/download');
    await fetchPdfBytes('/api/documents/b/download');

    // 2 for the first document (blocked binary + envelope), 1 for the second.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('transport=json');
  });

  it('reports not_found without a second attempt', async () => {
    stubWindow();
    const fetchMock = vi.fn(async () => new Response('missing', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPdfBytes('/api/documents/x/download')).resolves.toMatchObject({
      ok: false,
      reason: 'not_found',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('survives a network throw by trying the envelope', async () => {
    stubWindow();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonEnvelope(PDF));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPdfBytes('/api/documents/x/download')).resolves.toMatchObject({
      ok: true,
      transport: 'json',
    });
  });

  it('never hands pdf.js non-PDF bytes, even from the envelope', async () => {
    stubWindow();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(binaryResponse(BLOCK_PAGE))
      .mockResolvedValueOnce(jsonEnvelope(BLOCK_PAGE));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPdfBytes('/api/documents/x/download')).resolves.toMatchObject({
      ok: false,
      reason: 'blocked',
    });
  });
});
