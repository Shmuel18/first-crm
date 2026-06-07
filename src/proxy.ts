import { randomUUID } from 'node:crypto';

import { type NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';

/**
 * Attaches a per-request ID to both the request (so server actions and route
 * handlers can read it via next/headers) and the response (so the browser
 * can echo it back in a support ticket). Honors an upstream-supplied
 * `X-Request-Id` when present (e.g., from Vercel edge or a tracing proxy);
 * otherwise mints a UUIDv4.
 */
export async function proxy(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? randomUUID();
  // NextRequest.headers is mutable; downstream readers via next/headers see
  // this value once we return the response built from this request.
  request.headers.set('x-request-id', requestId);

  const response = await updateSession(request);
  response.headers.set('x-request-id', requestId);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, robots.txt, sitemap.xml
     * - PWA assets (manifest.webmanifest, sw.js, offline.html) — public, must be
     *   reachable without an auth round-trip for install/registration to work
     * - public files (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|sw\\.js|offline\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
