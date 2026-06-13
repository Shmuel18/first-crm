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
  roleId: z.uuid(),
  permissionId: z.uuid(),
  granted: z.boolean(),
});

export async function toggleRolePermissionAction(
  roleId: string,
  permissionId: string,
  granted: boolean,
): Promise<Result> {
  const parsed = schema.safeParse({ roleId, permissionId, granted });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  // The admin role is fixed (all permissions) and cannot be edited.
  const { data: role } = await supabase
    .from('roles')
    .select('key')
    .eq('id', parsed.data.roleId)
    .maybeSingle();
  if (!role) return { ok: false, error: 'unknown' };
  if (role.key === 'admin') return { ok: false, error: 'admin_locked' };

  // Hidden (unenforced) keys are filtered from the editor — enforce the same
  // rule on WRITE so a direct action call can't plant a dormant grant that
  // silently activates if the key is ever wired to a real check (R3-roles-4).
  const { data: perm } = await supabase
    .from('permissions')
    .select('key')
    .eq('id', parsed.data.permissionId)
    .maybeSingle();
  if (!perm) return { ok: false, error: 'unknown' };
  if (HIDDEN_PERMISSION_KEYS.has(perm.key)) return { ok: false, error: 'validation' };

  const { data: upserted, error } = await supabase
    .from('role_permissions')
    .upsert(
      {
        role_id: parsed.data.roleId,
        permission_id: parsed.data.permissionId,
        is_granted: parsed.data.granted,
      },
      { onConflict: 'role_id,permission_id' },
    )
    .select('role_id');

  if (error) {
    console.error('[toggle-role-permission] upsert failed', { code: error.code });
    return { ok: false, error: 'unknown' };
  }
  if (!upserted || upserted.length === 0) return { ok: false, error: 'unauthorized' };

  // The editor lives on /settings/people (the /settings/roles route is a
  // redirect stub) — revalidate the page that actually renders it.
  revalidatePath('/settings/people');
  return { ok: true };
}
