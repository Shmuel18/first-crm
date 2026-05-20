import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';

import type { Database } from '@/types/database';

/**
 * Service-role Supabase client. BYPASSES Row Level Security.
 *
 * Use ONLY in server actions, after the caller's admin status has already
 * been verified with the regular (cookie-bound) client. It reads
 * SUPABASE_SERVICE_ROLE_KEY — a server-only env var that @t3-oss/env-nextjs
 * refuses to expose on the client, so importing this into a client component
 * throws at build/runtime.
 *
 * Currently used for auth.admin operations (creating team members) that the
 * anon/authenticated key cannot perform.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
