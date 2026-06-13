'use server';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';

import { revokeUserSessions } from '@/lib/auth/session';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

import { DeleteMemberSchema } from '../schemas/team.schema';

type Result =
  | { ok: true }
  | {
      ok: false;
      error: 'unauthorized' | 'validation' | 'self_delete' | 'protected' | 'unknown';
    };

/**
 * "Delete" a team member = soft delete. The profiles row is KEPT so every
 * historical reference stays attributed to them — audit_log.user_id, closed/
 * archived cases, authored notes.
 *
 * The whole sequence (open-case reassign → pending-task reassign →
 * associated-advisor cleanup → profile soft-delete) runs in ONE transaction
 * via the admin_delete_member RPC (mig 170) — previously four independent
 * writes, where a mid-sequence failure left cases reassigned but the member
 * still active (R3-team-2). The RPC re-verifies admin, blocks self-delete and
 * refuses protected (owner) targets.
 */
export async function deleteMemberAction(userId: string): Promise<Result> {
  const parsed = DeleteMemberSchema.safeParse({ userId });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) return { ok: false, error: 'unauthorized' };

  // Guard against an admin deleting their own account out from under them.
  if (parsed.data.userId === userRes.user.id) {
    return { ok: false, error: 'self_delete' };
  }

  // Clean typed error for the protected owner (the RPC re-checks as the hard
  // guarantee). Untyped client: is_protected (mig 170) predates the types.
  const { data: target } = await (supabase as unknown as SupabaseClient)
    .from('profiles')
    .select('is_protected')
    .eq('id', parsed.data.userId)
    .maybeSingle();
  if (target?.is_protected === true) return { ok: false, error: 'protected' };

  // Atomic reassign + cleanup + soft-delete (mig 170). Untyped client: the
  // RPC predates the generated types — regenerate to drop the cast.
  const { error } = await (supabase as unknown as SupabaseClient).rpc('admin_delete_member', {
    p_user_id: parsed.data.userId,
  });
  if (error) {
    console.error('[deleteMember] rpc failed', safeDbError(error));
    return { ok: false, error: error.code === '42501' ? 'unauthorized' : 'unknown' };
  }

  // SEC-AUTH-1: revoke the deleted member's sessions so they're signed out now,
  // not whenever their token happens to expire. Best-effort (the soft-delete
  // already committed); the middleware gate is the hard guarantee.
  const revoke = await revokeUserSessions(supabase, parsed.data.userId);
  if (!revoke.ok) {
    // Details already logged inside revokeUserSessions.
    console.error('[deleteMember] session revoke failed', {
      userId: parsed.data.userId,
    });
  }

  revalidatePath('/settings/people');
  return { ok: true };
}
