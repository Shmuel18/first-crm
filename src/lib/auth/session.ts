import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

/**
 * SEC-AUTH-1 session helpers wrapping two RPCs added in migration 122.
 *
 * `src/types/database.ts` is generated from the live schema and does not yet
 * include these functions, so the `rpc` calls are cast through `unknown` to a
 * minimal local shape. Keeping the cast HERE (one justified place) means the
 * middleware and the team actions stay fully typed. Regenerate the Supabase
 * types after migration 122 is applied to drop these casts.
 */

type ActiveRpc = {
  rpc: (
    fn: 'current_user_active',
  ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
};

type RevokeRpc = {
  rpc: (
    fn: 'revoke_user_sessions',
    args: { p_user_id: string },
  ) => Promise<{ data: number | null; error: { message: string } | null }>;
};

/**
 * Whether the CURRENTLY authenticated user is still active (not deactivated,
 * not soft-deleted). `active` is fail-closed (FALSE when the row is gone), and
 * `error` flags a transient failure so callers can avoid logging a user out on
 * a mere DB blip.
 */
export async function isCurrentUserActive(
  supabase: SupabaseClient<Database>,
): Promise<{ active: boolean | null; error: boolean }> {
  const { data, error } = await (supabase as unknown as ActiveRpc).rpc('current_user_active');
  return { active: data, error: Boolean(error) };
}

/**
 * Hard-revoke all of a user's auth sessions (admin-only, enforced in the RPC).
 * Best-effort by contract: callers should treat a failure as non-fatal, since
 * the per-request gate also blocks the user. The raw Supabase error is logged
 * HERE and never returned — surfacing error.message past a helper boundary is
 * the leak pattern CLAUDE.md forbids.
 */
export async function revokeUserSessions(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ ok: boolean }> {
  const { error } = await (supabase as unknown as RevokeRpc).rpc('revoke_user_sessions', {
    p_user_id: userId,
  });
  if (error) {
    console.error('[revokeUserSessions] RPC failed', { userId, message: error.message });
    return { ok: false };
  }
  return { ok: true };
}
