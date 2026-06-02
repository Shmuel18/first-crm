import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Backup-freshness helpers (SRE-2, migration 126). All go through the
 * service-role admin client and call SECURITY DEFINER RPCs, so they work from
 * CRON_SECRET-gated routes (no user) and the admin-gated settings page alike.
 *
 * The RPCs aren't in the generated `database.ts` yet — regenerate types after
 * migration 126 is applied to drop the casts.
 */

/** A backup is "stale" once it's missing or older than this (matches the
 *  watchdog window — a daily backup leaves comfortable margin). */
export const BACKUP_STALE_AFTER_MS = 26 * 60 * 60 * 1000;

export function isBackupStale(lastBackupAt: string | null): boolean {
  if (!lastBackupAt) return true;
  return Date.now() - new Date(lastBackupAt).getTime() > BACKUP_STALE_AFTER_MS;
}

/** Stamp a verified backup success (called by /api/cron/backup). Best-effort. */
export async function recordBackupSuccess(): Promise<void> {
  const admin = createAdminClient();
  const { error } = await (
    admin as unknown as {
      rpc: (fn: 'record_backup_success') => Promise<{ error: { message: string } | null }>;
    }
  ).rpc('record_backup_success');
  if (error) console.error('[backup-freshness] record failed', { message: error.message });
}

export async function getLastBackupAt(): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await (
    admin as unknown as {
      rpc: (fn: 'get_last_backup_at') => Promise<{ data: string | null }>;
    }
  ).rpc('get_last_backup_at');
  return data ?? null;
}

export async function getActiveAdminEmails(): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await (
    admin as unknown as {
      rpc: (fn: 'active_admin_emails') => Promise<{ data: string[] | null }>;
    }
  ).rpc('active_admin_emails');
  return data ?? [];
}

/** Raise a deduped in-app 'backup_stale' bell for every active admin (mig 128). */
export async function notifyAdminsBackupStale(lastBackupAt: string | null): Promise<number> {
  const admin = createAdminClient();
  const { data } = await (
    admin as unknown as {
      rpc: (
        fn: 'notify_admins_backup_stale',
        args: { p_last_backup_at: string | null },
      ) => Promise<{ data: number | null }>;
    }
  ).rpc('notify_admins_backup_stale', { p_last_backup_at: lastBackupAt });
  return data ?? 0;
}
