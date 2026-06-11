import { afterEach, describe, expect, it, vi } from 'vitest';

import { createIntakeLead } from '@/features/intake/services/create-intake-lead';

import { OPTIONS, POST } from './route';

vi.mock('@/features/intake/services/create-intake-lead', () => ({
  createIntakeLead: vi.fn(),
}));

const ORIGIN = 'https://kaufman-finance.com';

function request(
  body: unknown,
  {
    origin = ORIGIN,
    contentType = 'application/json',
  }: { origin?: string; contentType?: string } = {},
): Request {
  return new Request('https://crm.kaufman-finance.com/api/web-lead', {
    method: 'POST',
    headers: { origin, 'content-type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const validBody = {
  name: 'Ada Lovelace',
  email: 'ADA@example.com',
  subject: 'Mortgage',
  message: 'Please call me',
  locale: 'en',
  company: '',
  elapsed_ms: 3000,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('/api/web-lead', () => {
  it('allows preflight only from the landing origin', async () => {
    const allowed = await OPTIONS(
      new Request('https://crm.kaufman-finance.com/api/web-lead', {
        method: 'OPTIONS',
        headers: { origin: ORIGIN },
      }),
    );
    const denied = await OPTIONS(
      new Request('https://crm.kaufman-finance.com/api/web-lead', {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.example' },
      }),
    );

    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(denied.status).toBe(403);
  });

  it('refuses other origins and non-JSON requests before the write path', async () => {
    const wrongOrigin = await POST(request(validBody, { origin: 'https://evil.example' }));
    const wrongType = await POST(request(validBody, { contentType: 'text/plain' }));

    expect(wrongOrigin.status).toBe(403);
    expect(wrongType.status).toBe(415);
    expect(createIntakeLead).not.toHaveBeenCalled();
  });

  it('rejects malformed and oversized JSON before the write path', async () => {
    const malformed = await POST(request('{'));
    const oversized = await POST(request(JSON.stringify({ name: 'x'.repeat(17_000) })));

    expect(malformed.status).toBe(400);
    expect(oversized.status).toBe(413);
    expect(createIntakeLead).not.toHaveBeenCalled();
  });

  it('acknowledges honeypot and implausibly-fast submissions without writing', async () => {
    const bot = await POST(request({ ...validBody, company: 'spam ltd' }));
    const tooFast = await POST(request({ ...validBody, elapsed_ms: 100 }));

    expect(bot.status).toBe(200);
    expect(tooFast.status).toBe(200);
    expect(createIntakeLead).not.toHaveBeenCalled();
  });

  it('validates and maps a legitimate contact request onto the shared intake path', async () => {
    vi.mocked(createIntakeLead).mockResolvedValue({ ok: true });

    const response = await POST(request(validBody));

    expect(response.status).toBe(200);
    expect(createIntakeLead).toHaveBeenCalledWith(
      {
        borrowers: [
          {
            first_name: 'Ada',
            last_name: 'Lovelace',
            email: 'ada@example.com',
          },
        ],
        request_details: '[Website contact form] Mortgage — Please call me',
        locale: 'en',
        consent: true,
      },
      'en',
      'web_contact',
    );
  });

  it('maps rate-limit and write failures to distinct status codes', async () => {
    vi.mocked(createIntakeLead).mockResolvedValueOnce({ ok: false, error: 'rate_limited' });
    const limited = await POST(request(validBody));

    vi.mocked(createIntakeLead).mockResolvedValueOnce({ ok: false, error: 'unknown' });
    const failed = await POST(request(validBody));

    expect(limited.status).toBe(429);
    expect(failed.status).toBe(502);
  });
});
