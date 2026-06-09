import type { Database } from '@/types/database';

/**
 * Server-free constants/types for the banks feature. Kept out of
 * banks.service.ts (which imports the server-only Supabase client) so Client
 * Components can use the bucket name + row type without pulling server code
 * into the browser bundle.
 */

/** Public bucket for admin-uploaded lender logos (migration 158). */
export const BANK_LOGOS_BUCKET = 'bank-logos';

export type Bank = Database['public']['Tables']['banks']['Row'];
