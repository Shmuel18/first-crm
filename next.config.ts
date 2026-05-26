import type { NextConfig } from 'next';

import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

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
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      'upgrade-insecure-requests',
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
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
  // migration 062 mirrored them into /public/banks/*.svg so the dashboard
  // doesn't depend on a third-party CDN per bank cell. No remote image
  // hosts needed by the app today — if one is added later, declare it
  // here under `images.remotePatterns`.
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(nextConfig);
