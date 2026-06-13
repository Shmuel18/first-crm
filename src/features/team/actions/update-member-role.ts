'use server';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';

import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

import { UpdateRoleSchema } from '../schemas/team.schema';

type Result =
  | { ok: true }
  | {
      ok: false;
      error: 'unauthorized' | 'validation' | 'self_role_change' | 'protected' | 'unknown';
      message?: string;
    };

export async function updateMemberRoleAction(userId: string, roleId: string): Promise<Result> {
  const parsed = UpdateRoleSchema.safeParse({ userId, roleId });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) return { ok: false, error: 'unauthorized' };

  // Guard against an admin demoting themselves and losing access mid-session.
  // Role changes to your own account must go through another admin.
  if (parsed.data.userId === userRes.user.id) {
    return { ok: false, error: 'self_role_change' };
  }

  // The protected owner's role is fixed (mig 170 trigger is the hard
  // guarantee; this pre-check returns a clean typed error instead).
  // Untyped client: is_protected (mig 170) predates the generated types.
  const { data: target } = await (supabase as unknown as SupabaseClient)
    .from('profiles')
    .select('is_protected')
    .eq('id', parsed.data.userId)
    .maybeSingle();
  if (target?.is_protected === true) {
    return { ok: false, error: 'protected' };
  }

  // .select() lets us confirm a row actually changed. If RLS (manage_users)
  // blocks the write it affects 0 rows with no error — surface that instead of
  // reporting a false success.
  const { data: updated, error } = await supabase
    .from('profiles')
    .update({ role_id: parsed.data.roleId })
    .eq('id', parsed.data.userId)
    .select('id');

  if (error) {
    console.error('[updateMemberRole] db error', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  revalidatePath('/team');
  return { ok: true };
}
