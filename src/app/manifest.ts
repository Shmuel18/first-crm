import type { MetadataRoute } from 'next';

import { BRAND } from '@/lib/brand';

/**
 * Web app manifest — served at /manifest.webmanifest; Next auto-injects the
 * <link rel="manifest"> tag. Makes the CRM installable to the phone home screen
 * (standalone window, own icon). Static (no per-request data). Icons live in
 * /public/icons, generated from src/app/icon.png with sharp — regenerate if the
 * logo changes.
 */
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.nameEn,
    short_name: BRAND.shortNameEn,
    description: 'מערכת ניהול תיקי משכנתא',
    // Launching opens the cases dashboard. Unauthenticated → the middleware
    // bounces /cases to /login?next=/cases, so the app lands correctly post-login.
    start_url: '/cases',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'he',
    dir: 'rtl',
    theme_color: BRAND.themeColor,
    background_color: BRAND.themeColor,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
