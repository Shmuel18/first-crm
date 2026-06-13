'use server';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';

import { revokeUserSessions } from '@/lib/auth/session';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

import { SetActiveSchema } from '../schemas/team.schema';

type Result =
  | { ok: true }
  | {
      ok: false;
      error: 'unauthorized' | 'validation' | 'self_deactivate' | 'protected' | 'unknown';
      message?: string;
    };

export async function setMemberActiveAction(userId: string, isActive: boolean): Promise<Result> {
  const parsed = SetActiveSchema.safeParse({ userId, isActive });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) return { ok: false, error: 'unauthorized' };

  // Guard against an admin locking themselves out.
  if (!parsed.data.isActive && parsed.data.userId === userRes.user.id) {
    return { ok: false, error: 'self_deactivate' };
  }

  // The protected owner account can't be deactivated (mig 170 trigger is the
  // hard guarantee; this pre-check returns a clean typed error instead).
  // Untyped client: is_protected (mig 170) predates the generated types.
  if (!parsed.data.isActive) {
    const { data: target } = await (supabase as unknown as SupabaseClient)
      .from('profiles')
      .select('is_protected')
      .eq('id', parsed.data.userId)
      .maybeSingle();
    if (target?.is_protected === true) {
      return { ok: false, error: 'protected' };
    }
  }

  // .select() confirms a row changed; 0 rows means RLS (manage_users) blocked
  // the write, which we surface rather than reporting a false success.
  const { data: updated, error } = await supabase
    .from('profiles')
    .update({ is_active: parsed.data.isActive })
    .eq('id', parsed.data.userId)
    .select('id');

  if (error) {
    console.error('[setMemberActive] db error', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  // SEC-AUTH-1: on deactivation, hard-revoke the member's sessions so it takes
  // effect now (the middleware gate also bounces them; this kills the refresh
  // token so the session can't be renewed). Best-effort — the flag already
  // flipped, so a revoke hiccup must not fail the operation.
  if (!parsed.data.isActive) {
    const revoke = await revokeUserSessions(supabase, parsed.data.userId);
    if (!revoke.ok) {
      // Details already logged inside revokeUserSessions.
      console.error('[setMemberActive] session revoke failed', {
        userId: parsed.data.userId,
      });
    }
  }

  revalidatePath('/team');
  return { ok: true };
}
