'use server';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';

import { revokeUserSessions } from '@/lib/auth/session';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

import { DeleteMemberSchema } from '../schemas/team.schema';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'self_delete' | 'unknown' };

/**
 * "Delete" a team member = soft delete. The profiles row is KEPT so every
 * historical reference stays attributed to them — audit_log.user_id (which has
 * no name snapshot), closed/archived cases, authored notes. A hard delete would
 * be refused by those FKs or blank out the name.
 *
 * Instead we:
 *   1. Reassign their still-open work (active cases + pending tasks) to the
 *      acting manager, so it keeps a responsible owner going forward. Closed /
 *      archived cases and completed tasks keep the original advisor for history.
 *   2. Stamp deleted_at + is_active=false: removed from the team list (filtered
 *      on deleted_at) and blocked from signing in (same gate as deactivation).
 */
export async function deleteMemberAction(userId: string): Promise<Result> {
  const parsed = DeleteMemberSchema.safeParse({ userId });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  const managerId = userRes.user.id;

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) return { ok: false, error: 'unauthorized' };

  // Guard against an admin deleting their own account out from under them.
  if (parsed.data.userId === managerId) {
    return { ok: false, error: 'self_delete' };
  }

  // 1) Move still-open work to the acting manager. Bail before the soft-delete
  //    if either reassignment errors, so we never leave a half-applied state.
  const { error: caseErr } = await supabase
    .from('cases')
    .update({ assigned_advisor_id: managerId })
    .eq('assigned_advisor_id', parsed.data.userId)
    .is('deleted_at', null)
    .eq('is_archived', false);
  if (caseErr) {
    console.error('[deleteMember] case reassign failed', safeDbError(caseErr));
    return { ok: false, error: 'unknown' };
  }

  const { error: taskErr } = await supabase
    .from('tasks')
    .update({ assigned_to: managerId })
    .eq('assigned_to', parsed.data.userId)
    .eq('status', 'pending')
    .is('deleted_at', null);
  if (taskErr) {
    console.error('[deleteMember] task reassign failed', safeDbError(taskErr));
    return { ok: false, error: 'unknown' };
  }

  // Drop their associated-advisor rows (migration 146) — they no longer work
  // these cases. (Cases where they were RESPONSIBLE were reassigned above. The
  // FK is ON DELETE CASCADE, but the profile is SOFT-deleted, so the cascade
  // never fires — clean these up explicitly.) Untyped: case_associated_advisors
  // isn't in the generated Database types yet.
  const { error: assocErr } = await (supabase as unknown as SupabaseClient)
    .from('case_associated_advisors')
    .delete()
    .eq('advisor_id', parsed.data.userId);
  if (assocErr) {
    console.error('[deleteMember] associated-advisor cleanup failed', safeDbError(assocErr));
    return { ok: false, error: 'unknown' };
  }

  // 2) Soft-delete the profile. .select() confirms RLS (manage_users) allowed
  //    the write; 0 rows means it was blocked, surfaced rather than faked.
  const { data: updated, error: profErr } = await supabase
    .from('profiles')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', parsed.data.userId)
    .select('id');
  if (profErr) {
    console.error('[deleteMember] soft-delete failed', safeDbError(profErr));
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  // SEC-AUTH-1: revoke the deleted member's sessions so they're signed out now,
  // not whenever their token happens to expire. Best-effort (the soft-delete
  // already succeeded); the middleware gate is the hard guarantee.
  const revoke = await revokeUserSessions(supabase, parsed.data.userId);
  if (!revoke.ok) {
    console.error('[deleteMember] session revoke failed', {
      userId: parsed.data.userId,
      error: revoke.error,
    });
  }

  revalidatePath('/settings/people');
  return { ok: true };
}
