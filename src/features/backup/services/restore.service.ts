import { createClient } from '@/lib/supabase/server';

import type { Json } from '@/types/database';

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
  // The RPC is typed `p_snapshot: Json`. BackupSnapshot is JSON-shaped but
  // TS can't widen it structurally, so widen once at the call boundary —
  // callers above stay typed against BackupSnapshot.
  const { data, error } = await supabase.rpc('restore_backup_snapshot', {
    p_snapshot: snapshot as unknown as Json,
  });
  if (error) throw new Error(error.message);
  return (data ?? {}) as RestoreCounts;
}
