import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Erasure-freshness helpers (LEGAL-3 observability, migration 144). Mirror of
 * backup-freshness: the daily /api/cron/cleanup-orphaned-blobs stamps
 * office_settings.last_erasure_at on a successful run; the erasure-watchdog cron
 * reads it and alerts admins (email + in-app bell) when the eraser has not
 * succeeded in the staleness window. All go through the service-role admin
 * client + SECURITY DEFINER RPCs, so they work from CRON_SECRET-gated routes.
 *
 * The RPCs aren't in the generated `database.ts` yet — regenerate types after
 * migration 144 is applied to drop the casts.
 */

/** Erasure is "stale" once it's missing or older than this. The eraser runs
 *  daily, so this leaves comfortable margin (matches the backup watchdog). */
export const ERASURE_STALE_AFTER_MS = 26 * 60 * 60 * 1000;

export function isErasureStale(lastErasureAt: string | null): boolean {
  if (!lastErasureAt) return true;
  return Date.now() - new Date(lastErasureAt).getTime() > ERASURE_STALE_AFTER_MS;
}

/** Stamp a successful erasure run (called by /api/cron/cleanup-orphaned-blobs). */
export async function recordErasureSuccess(): Promise<void> {
  const admin = createAdminClient();
  const { error } = await (
    admin as unknown as {
      rpc: (fn: 'record_erasure_success') => Promise<{ error: { message: string } | null }>;
    }
  ).rpc('record_erasure_success');
  if (error) console.error('[erasure-freshness] record failed', { message: error.message });
}

export async function getLastErasureAt(): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await (
    admin as unknown as {
      rpc: (fn: 'get_last_erasure_at') => Promise<{ data: string | null }>;
    }
  ).rpc('get_last_erasure_at');
  return data ?? null;
}

/** Active admin emails — recipients for infrastructure alerts (shared RPC,
 *  migration 126). Re-wrapped here so the erasure watchdog stays self-contained
 *  on the documents feature rather than reaching into the backup feature. */
export async function getActiveAdminEmails(): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await (
    admin as unknown as {
      rpc: (fn: 'active_admin_emails') => Promise<{ data: string[] | null }>;
    }
  ).rpc('active_admin_emails');
  return data ?? [];
}

/** Raise a deduped in-app 'erasure_stale' bell for every active admin (mig 144). */
export async function notifyAdminsErasureStale(lastErasureAt: string | null): Promise<number> {
  const admin = createAdminClient();
  const { data } = await (
    admin as unknown as {
      rpc: (
        fn: 'notify_admins_erasure_stale',
        args: { p_last_erasure_at: string | null },
      ) => Promise<{ data: number | null }>;
    }
  ).rpc('notify_admins_erasure_stale', { p_last_erasure_at: lastErasureAt });
  return data ?? 0;
}
