import { NextResponse, type NextRequest } from 'next/server';

import { createServerClient } from '@supabase/ssr';

import { isCurrentUserActive } from '@/lib/auth/session';
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
    matches('/simulators') ||
    matches('/statistics') ||
    matches('/dashboard') ||
    // /auth/set-password is hit AFTER /auth/callback runs the code exchange
    // and writes session cookies. An unauth visit here is invalid (no session
    // to update), so bounce to /login like any protected page.
    // /auth/callback itself is intentionally NOT protected — the exchange
    // happens BEFORE there's a session.
    matches('/auth/set-password');
  const isAuthRoute =
    matches('/login') || matches('/signup') || matches('/forgot-password');

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Preserve the intended destination so login can return the user there.
    // Mirrors the same-origin `next` convention in /auth/callback.
    const next = request.nextUrl.pathname + request.nextUrl.search;
    url.search = '';
    url.searchParams.set('next', next);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/cases';
    return NextResponse.redirect(url);
  }

  // SEC-AUTH-1: a member deactivated/deleted mid-session keeps a valid cookie
  // (refresh rotation renews it). RLS blocks their writes, not app access/reads.
  // On every authenticated protected request, re-check active status and, if the
  // account is gone, drop the session cookies and bounce to /login. Only runs
  // for logged-in users on protected routes, so auth/static traffic pays nothing.
  // Skip the active-status RPC on speculative RSC PREFETCHES. Next fires a burst
  // of prefetches for visible nav links (and after every server-action
  // revalidation), and adding a DB round-trip to each saturates the auth path —
  // the cause of intermittent 503s on a small single instance. A prefetch never
  // renders to the user; the REAL navigation that follows is not a prefetch and
  // runs this gate, so the deactivation check still closes on the next actual
  // request (SEC-AUTH-1's own "next request re-checks" guarantee). getUser()
  // above still runs so the session stays fresh.
  const isPrefetch =
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch' ||
    request.headers.get('x-purpose') === 'prefetch';

  if (user && isProtectedRoute && !isPrefetch) {
    const { active, error: activeError } = await isCurrentUserActive(supabase);
    // Fail-closed on an explicit FALSE only. A transient RPC error is NOT treated
    // as inactive (a DB blip shouldn't sign everyone out); RLS still guards data
    // and the next request re-checks.
    if (!activeError && active === false) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      url.searchParams.set('reason', 'deactivated');
      const redirect = NextResponse.redirect(url);
      // Carry the just-cleared auth cookies onto the redirect, otherwise the
      // browser keeps the session and the isAuthRoute rule ping-pongs it back.
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
      return redirect;
    }
  }

  return response;
}
