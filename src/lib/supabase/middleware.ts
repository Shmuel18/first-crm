import { NextResponse, type NextRequest } from 'next/server';

import { createServerClient } from '@supabase/ssr';

import { env } from '@/lib/env';

import type { Database } from '@/types/database';

/**
 * Updates the session cookie on every request.
 * Must run in middleware to keep auth fresh.
 */
export async function updateSession(request: NextRequest) {
  // CORS preflight (OPTIONS) and HEAD requests don't need a session refresh
  // and never trigger a redirect — skip the Supabase round-trip so the
  // browser's preflight isn't blocked on a DB call.
  if (request.method === 'OPTIONS' || request.method === 'HEAD') {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: refresh the session token. Do not put logic here that could
  // change the response (other than auth).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from protected routes.
  // Use exact-or-prefix-with-slash matching so /loginfake, /casesx etc. don't
  // accidentally classify a future route into the wrong bucket.
  //
  // NOTE on /api routes: they are deliberately NOT in isProtectedRoute. A
  // browser redirect to /login is the wrong response for a JSON endpoint —
  // /api/cron/backup uses CRON_SECRET (no cookie at all), and other API
  // routes return JSON errors. Every new /api/* route MUST check auth at
  // the route handler level (see /api/auth/google/* for the pattern).
  const pathname = request.nextUrl.pathname;
  const matches = (p: string): boolean =>
    pathname === p || pathname.startsWith(p + '/');
  const isProtectedRoute =
    matches('/cases') ||
    matches('/leads') ||
    matches('/tasks') ||
    matches('/team') ||
    matches('/templates') ||
    matches('/audit-log') ||
    matches('/settings') ||
    matches('/dashboard') ||
    // /auth/set-password is hit AFTER /auth/callback runs the code exchange
    // and writes session cookies. An unauth visit here is invalid (no session
    // to update), so bounce to /login like any protected page.
    // /auth/callback itself is intentionally NOT protected — the exchange
    // happens BEFORE there's a session.
    matches('/auth/set-password');
  const isAuthRoute = matches('/login') || matches('/signup');

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/cases';
    return NextResponse.redirect(url);
  }

  return response;
}
