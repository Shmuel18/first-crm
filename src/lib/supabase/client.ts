import { createBrowserClient } from '@supabase/ssr';

import { env } from '@/lib/env';

import type { Database } from '@/types/database';

/**
 * Supabase client for browser (Client Components).
 * Uses the anon key - all queries respect Row Level Security (RLS).
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
