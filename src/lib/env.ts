import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * Type-safe environment variables.
 * Throws at build time if any required variable is missing.
 */
export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Missing SUPABASE_SERVICE_ROLE_KEY'),
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    NEXT_PUBLIC_APP_NAME: z.string().default('Kaufman Finance Group'),
    NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  },
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  emptyStringAsUndefined: true,
});
