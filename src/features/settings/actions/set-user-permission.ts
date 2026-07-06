'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { HIDDEN_PERMISSION_KEYS } from '../permissions.constants';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'admin_locked' | 'unknown' };

const schema = z.object({
  userId: z.uuid(),
  permissionId: z.uuid(),
  mode: z.enum(['grant', 'revoke', 'reset']),
});

/**
 * Set (or clear) ONE per-user permission exception. `grant`/`revoke` pin the
 * permission on/off for this person regardless of their role; `reset` removes
 * the override so they follow the role default again. Overrides win in
 * has_permission(), so this is the per-employee permission control.
 */
export async function setUserPermissionAction(
  userId: string,
  permissionId: string,
  mode: 'grant' | 'revoke' | 'reset',
): Promise<Result> {
  const parsed = schema.safeParse({ userId, permissionId, mode });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  // The manager (admin role) is fixed — its permissions can never be overridden.
  const { data: target } = await supabase
    .from('profiles')
    .select('role_id')
    .eq('id', parsed.data.userId)
    .maybeSingle();
  if (!target) return { ok: false, error: 'unknown' };
  if (target.role_id) {
    const { data: role } = await supabase
      .from('roles')
      .select('key')
      .eq('id', target.role_id)
      .maybeSingle();
    if (role?.key === 'admin') return { ok: false, error: 'admin_locked' };
  }

  // Hidden (unenforced) keys can't be planted per-user either (mirrors the roles editor).
  const { data: perm } = await supabase
    .from('permissions')
    .select('key')
    .eq('id', parsed.data.permissionId)
    .maybeSingle();
  if (!perm) return { ok: false, error: 'unknown' };
  if (HIDDEN_PERMISSION_KEYS.has(perm.key)) return { ok: false, error: 'validation' };

  if (parsed.data.mode === 'reset') {
    const { error } = await supabase
      .from('user_permission_overrides')
      .delete()
      .eq('user_id', parsed.data.userId)
      .eq('permission_id', parsed.data.permissionId);
    if (error) {
      console.error('[set-user-permission] delete failed', { code: error.code });
      return { ok: false, error: 'unknown' };
    }
  } else {
    const { data: upserted, error } = await supabase
      .from('user_permission_overrides')
      .upsert(
        {
          user_id: parsed.data.userId,
          permission_id: parsed.data.permissionId,
          is_granted: parsed.data.mode === 'grant',
          created_by: userRes.user.id,
        },
        { onConflict: 'user_id,permission_id' },
      )
      .select('user_id');
    if (error) {
      console.error('[set-user-permission] upsert failed', { code: error.code });
      return { ok: false, error: 'unknown' };
    }
    if (!upserted || upserted.length === 0) return { ok: false, error: 'unauthorized' };
  }

  revalidatePath('/settings/people');
  return { ok: true };
}
