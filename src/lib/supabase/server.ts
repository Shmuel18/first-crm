import { cookies } from 'next/headers';

import { createServerClient } from '@supabase/ssr';

import { env } from '@/lib/env';

import type { Database } from '@/types/database';

/**
 * Supabase client for server (Server Components, Server Actions, Route Handlers).
 * Reads and writes cookies for session management.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll called from a Server Component — safe to ignore.
            // Session refresh is handled by middleware.
          }
        },
      },
    },
  );
}
