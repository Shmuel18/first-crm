import type { NextConfig } from 'next';

import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isProduction = process.env.NODE_ENV === 'production';
const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
const isHttpsPublicApp = publicAppUrl.startsWith('https://');
const shouldUpgradeInsecureRequests = isProduction && isHttpsPublicApp;
const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://*.googleapis.com https://accounts.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-src 'none'",
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
 * - Permissions-Policy: disables sensors the CRM never asks for.
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
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=()',
  },
  {
    key: 'Content-Security-Policy',
    value: cspDirectives.join('; '),
  },
];

const nextConfig: NextConfig = {
  deploymentId: process.env.NEXT_DEPLOYMENT_ID,
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
  // Bank logos used to come from upload.wikimedia.org via remotePatterns;
  // migration 062 mirrored them locally, and migration 069 swapped to the
  // operator's branded PNG/JPG/WEBP files in /public/banks/. The dashboard
  // doesn't depend on a third-party CDN per bank cell. No remote image
  // hosts needed by the app today — if one is added later, declare it
  // here under `images.remotePatterns`.
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(nextConfig);
