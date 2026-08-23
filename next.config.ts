import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { NextConfig } from 'next';

import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Highest migration number under supabase/migrations/. /api/health compares the
 * DB's applied_schema_version() against this and fails readiness (503) when the
 * DB lags — so deploy.sh's pre-swap health check ABORTS a deploy whose migrations
 * were not applied first (see docs/DEPLOYING.md + migration 143). Computed at
 * BUILD time because the migrations dir isn't traced into the standalone runtime.
 */
function computeExpectedSchemaVersion(): string {
  try {
    const dir = join(process.cwd(), 'supabase', 'migrations');
    let max = 0;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.sql')) continue;
      const match = name.match(/^(\d+)/);
      if (!match) continue;
      const n = Number(match[1]);
      if (Number.isFinite(n)) max = Math.max(max, n);
    }
    return String(max);
  } catch {
    return '0';
  }
}

const isProduction = process.env.NODE_ENV === 'production';
const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
const isHttpsPublicApp = publicAppUrl.startsWith('https://');
const shouldUpgradeInsecureRequests = isProduction && isHttpsPublicApp;
const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://drive.google.com https://docs.google.com",
  // Task voice notes are served from short-lived signed Supabase Storage URLs.
  "media-src 'self' blob: https://*.supabase.co",
  "font-src 'self' data:",
  // wss://*.supabase.co — the Realtime WebSocket (instant notification bell).
  // Without it the browser blocks the wss connection under connect-src and the
  // bell only updates on navigation/refresh.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com https://accounts.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // blob: — the print path builds an off-screen iframe from a blob: URL of the
  // document (Storage blobs are cross-origin, so an iframe pointed straight at
  // the signed URL can't be told to print). Blob frames are same-origin and
  // created only by our own code.
  "frame-src 'self' blob: https://*.supabase.co https://drive.google.com https://docs.google.com",
  ...(shouldUpgradeInsecureRequests ? ['upgrade-insecure-requests'] : []),
];

/**
 * Baseline security headers. CSP intentionally omits script-src/style-src
 * tightening because Next 16 emits inline bootstrap scripts during
 * hydration — switching to a nonce-per-request CSP requires middleware
 * injection and is a separate follow-up. What ships here closes the
 * highest-leverage attack surfaces (clickjacking, MIME-confusion, downgrade,
 * form-action injection, base-tag injection) without breaking Next.
 *
 * - HSTS with preload: forces HTTPS for 2 years and qualifies for the
 *   browser preload list.
 * - X-Frame-Options DENY + CSP frame-ancestors 'none': belt-and-suspenders
 *   clickjacking defense.
 * - X-Content-Type-Options nosniff: blocks MIME-sniff confusion.
 * - Referrer-Policy strict-origin-when-cross-origin: URLs (which include
 *   /cases/:id) don't leak to third parties on link clicks.
 * - Permissions-Policy: disables sensors the CRM never asks for. Microphone is
 *   allowed for our OWN origin (self) — task voice-note recordings need
 *   getUserMedia; an empty allowlist blocks it before the permission prompt even
 *   shows. Camera/geolocation/payment stay fully disabled (unused).
 */
const SECURITY_HEADERS = [
  ...(isHttpsPublicApp
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=(), interest-cohort=(), payment=()',
  },
  {
    key: 'Content-Security-Policy',
    value: cspDirectives.join('; '),
  },
];

/** The one route whose responses our own pages put in an <iframe>. */
const DOCUMENT_BYTES_PATH = '/api/documents/:id/download';
/** Everything except that route — the catch-all can't overlap it, because the
 *  first matching entry does not win: overlapping entries both apply and the
 *  stricter framing headers would come back. */
const EVERYTHING_ELSE = '/((?!api/documents/[^/]+/download).*)';

const DOCUMENT_BYTES_HEADERS = [
  ...SECURITY_HEADERS.filter(
    (h) => h.key !== 'X-Frame-Options' && h.key !== 'Content-Security-Policy',
  ),
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  {
    // No sandbox: it blocks the browser's built-in PDF viewer, and it isn't
    // what keeps this safe — the route serves only an allowlisted set of
    // Content-Types (PDF, images, Office), so a document here is never HTML or
    // SVG and cannot run script of its own.
    key: 'Content-Security-Policy',
    value: "default-src 'none'; frame-ancestors 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  deploymentId: process.env.NEXT_DEPLOYMENT_ID,
  // react-pdf reads two assets off disk at render time:
  //   - public/fonts/heebo-regular.ttf  (features/cases/pdf/fonts.ts)
  //   - public/pdf/logo-coin.png        (cases/services/export/pdf-generator)
  // Vercel does NOT trace /public assets into a serverless function by default,
  // so those reads ENOENT in production while working fine locally. That broke
  // every PDF render once (bank file + simulator report → "render_failed"), and
  // again when the dashboard export grew a header logo pointing at an untraced
  // path (→ /api/exports/cases 500, "ייצוא נכשל").
  //
  // RULE: any file read with fs at runtime must sit under a path listed here.
  // public/pdf/ is the home for PDF render assets — add to that folder, not to
  // /public root, and the trace covers it automatically.
  outputFileTracingIncludes: {
    '/**': ['./public/fonts/**', './public/pdf/**'],
  },
  // Baked-in at build so /api/health can compare it to the DB's applied schema
  // version and fail readiness when prod lags the code (migration 143).
  env: {
    EXPECTED_SCHEMA_VERSION: computeExpectedSchemaVersion(),
  },
  // Hide Next's dev-only on-screen indicator (the bottom-start "N" overlay that
  // opens dev tools). It overlapped app UI and read as a stray logo; it never
  // ships in production, so this only cleans up the local dev view.
  devIndicators: false,
  experimental: {
    serverActions: {
      // Document uploads now use direct-to-storage via Supabase signed-upload
      // URLs (batch 25). Bytes go browser → Storage without passing through
      // Server Action memory; finalizeUploadAction only carries metadata.
      // 2 MB is comfortable headroom for any remaining Server Action payload
      // (form fields, JSON bodies) without inviting accidental large posts
      // back into the Vercel function memory budget.
      bodySizeLimit: '2mb',
    },
  },
  // Seeded bank logos are local in /public/banks/ (migrations 062/069). Admin-
  // uploaded lender logos (migration 158) live in the public `bank-logos`
  // Supabase Storage bucket, so allow optimizing images from that host. Scoped
  // to the public object path; matches the existing img-src CSP (*.supabase.co).
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      // The document-bytes route is framed BY OUR OWN PAGES (the preview modal
      // and the folder-grid thumbnails). The global clickjacking rule would
      // refuse that — frame-ancestors 'none' and XFO DENY block same-origin
      // framing too — and a config header wins over anything a route handler
      // sets, so this exemption has to live here. It stays narrow: only this
      // path, only 'self' as an ancestor, everything else unchanged.
      { source: DOCUMENT_BYTES_PATH, headers: DOCUMENT_BYTES_HEADERS },
      { source: EVERYTHING_ELSE, headers: SECURITY_HEADERS },
    ];
  },
};

export default withNextIntl(nextConfig);
