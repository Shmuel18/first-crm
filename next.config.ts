import type { NextConfig } from 'next';

import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Document uploads cap at 20 MB (document.schema MAX_FILE_SIZE_BYTES).
      // Add a 1 MB cushion for multipart envelope + form fields. Without
      // this, the action body limit defaults to 1 MB and uploads fail with
      // an opaque error before reaching our validation.
      // TODO: longer-term, switch to direct-to-storage uploads (Supabase
      // Storage signed-upload URLs or a streaming route handler) so the
      // 20 MB never hits Server Action memory.
      bodySizeLimit: '21mb',
    },
  },
  images: {
    // Bank logos (migration 019_bank_logos.sql) point at upload.wikimedia.org.
    // Allowlisted here so <Image> can serve them through Next's optimizer
    // instead of forcing every consumer to drop back to <img>.
    remotePatterns: [
      { protocol: 'https', hostname: 'upload.wikimedia.org', pathname: '/wikipedia/**' },
    ],
  },
};

export default withNextIntl(nextConfig);
