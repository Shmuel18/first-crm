import { NextResponse, type NextRequest } from 'next/server';

import { createServerClient } from '@supabase/ssr';

import { env } from '@/lib/env';

import type { Database } from '@/types/database';

/**
 * Updates the session cookie on every request.
 * Must run in middleware to keep auth fresh.
 */
export async function updateSession(request: NextRequest) {
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
    matches('/dashboard');
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
