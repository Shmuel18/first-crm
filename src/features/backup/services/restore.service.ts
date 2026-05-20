import { createClient } from '@/lib/supabase/server';

import type { BackupSnapshot } from '../schemas/snapshot.schema';

export type RestoreCounts = Record<string, number>;

/**
 * Call the restore_backup_snapshot RPC (migration 030). The RPC is
 * SECURITY DEFINER and re-checks is_admin() against the caller, so this uses
 * the cookie-bound client (not service-role) — auth.uid() must reflect the
 * signed-in admin for that gate to pass.
 */
export async function restoreSnapshot(snapshot: BackupSnapshot): Promise<RestoreCounts> {
  const supabase = await createClient();

  // restore_backup_snapshot is introduced in migration 030 and isn't in the
  // generated Database types yet; call it through a narrowly-typed rpc view.
  const rpc = supabase.rpc as unknown as (
    fn: 'restore_backup_snapshot',
    args: { p_snapshot: BackupSnapshot },
  ) => Promise<{ data: RestoreCounts | null; error: { message: string } | null }>;

  const { data, error } = await rpc('restore_backup_snapshot', { p_snapshot: snapshot });
  if (error) throw new Error(error.message);
  return data ?? {};
}
