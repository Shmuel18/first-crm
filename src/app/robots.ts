import type { MetadataRoute } from 'next';

/**
 * This is an internal CRM, not a public site (the marketing site lives on a
 * separate origin). Disallow all crawling so search engines don't index the
 * login, intake, or any app URL. RLS/auth already protect the data; this is
 * posture/hygiene. The proxy matcher (src/proxy.ts) already excludes
 * /robots.txt from the auth round-trip, so this serves to anonymous crawlers.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: '/' },
  };
}
