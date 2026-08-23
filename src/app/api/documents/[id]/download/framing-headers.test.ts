import { describe, expect, it } from 'vitest';

import nextConfig from '../../../../../../next.config';

/**
 * The document-bytes route is framed by our own pages (preview modal, folder
 * thumbnails). The app's global clickjacking headers — `X-Frame-Options: DENY`
 * and CSP `frame-ancestors 'none'` — block same-origin framing too, and a
 * config header REPLACES whatever the route handler sets, so the exemption can
 * only live in next.config. Getting this wrong renders every PDF preview and
 * every PDF tile as an empty box, silently, with no error anywhere.
 *
 * These assertions are the guard: a future edit that folds the route back into
 * the catch-all fails here instead of in the client's office.
 */
type HeaderEntry = { source: string; headers: Array<{ key: string; value: string }> };

const DOWNLOAD_PATH = '/api/documents/8b1f0c1e-0000-4000-8000-000000000000/download';

async function headerEntries(): Promise<HeaderEntry[]> {
  const headers = nextConfig.headers;
  if (!headers) throw new Error('next.config defines no headers()');
  return (await headers()) as HeaderEntry[];
}

/** Next's `source` matcher: `:param` segments and a leading `/((?!…).*)` regex. */
function matches(source: string, path: string): boolean {
  const asRegex = source.startsWith('/((?!')
    ? new RegExp(`^${source}$`)
    : new RegExp(`^${source.replace(/:[A-Za-z]+\*/g, '.*').replace(/:[A-Za-z]+/g, '[^/]+')}$`);
  return asRegex.test(path);
}

function valueOf(entry: HeaderEntry, key: string): string | undefined {
  return entry.headers.find((h) => h.key === key)?.value;
}

describe('framing headers for the document-bytes route', () => {
  it('lets our own pages frame it', async () => {
    const entries = await headerEntries();
    const applied = entries.filter((e) => matches(e.source, DOWNLOAD_PATH));

    expect(applied.length).toBeGreaterThan(0);
    for (const entry of applied) {
      expect(valueOf(entry, 'X-Frame-Options')).toBe('SAMEORIGIN');
      expect(valueOf(entry, 'Content-Security-Policy')).toContain("frame-ancestors 'self'");
      expect(valueOf(entry, 'Content-Security-Policy')).not.toContain("frame-ancestors 'none'");
    }
  });

  it('keeps every other path locked down', async () => {
    const entries = await headerEntries();
    for (const path of ['/cases', '/api/health', '/api/documents/x/other']) {
      const applied = entries.filter((e) => matches(e.source, path));
      expect(applied.length).toBeGreaterThan(0);
      for (const entry of applied) {
        expect(valueOf(entry, 'X-Frame-Options')).toBe('DENY');
        expect(valueOf(entry, 'Content-Security-Policy')).toContain("frame-ancestors 'none'");
      }
    }
  });

  it('still sends the non-framing protections on the bytes route', async () => {
    const entries = await headerEntries();
    const entry = entries.find((e) => matches(e.source, DOWNLOAD_PATH));
    expect(entry).toBeDefined();
    expect(valueOf(entry as HeaderEntry, 'X-Content-Type-Options')).toBe('nosniff');
    expect(valueOf(entry as HeaderEntry, 'Referrer-Policy')).toBeDefined();
    expect(valueOf(entry as HeaderEntry, 'Content-Security-Policy')).toContain("object-src 'none'");
  });
});
