import { createClient } from '@/lib/supabase/server';

export type PermissionCategory =
  | 'view'
  | 'financial'
  | 'cases'
  | 'leads'
  | 'documents'
  | 'system';

export type PermissionRow = {
  id: string;
  key: string;
  name_he: string;
  name_en: string;
  category: PermissionCategory;
};

export type RoleRow = {
  id: string;
  key: string;
  name_he: string;
  name_en: string;
  is_system: boolean;
};

export type RolesPermissionsData = {
  roles: RoleRow[];
  permissions: PermissionRow[];
  /** roleId → array of granted permissionIds. */
  granted: Record<string, string[]>;
};

export async function getRolesPermissions(): Promise<RolesPermissionsData> {
  const supabase = await createClient();

  const [rolesRes, permsRes, rpRes] = await Promise.all([
    supabase
      .from('roles')
      .select('id, key, name_he, name_en, is_system')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('permissions')
      .select('id, key, name_he, name_en, category')
      .order('category')
      .order('key'),
    supabase.from('role_permissions').select('role_id, permission_id').eq('is_granted', true),
  ]);

  // A silently-empty editor reads as "all roles deleted" — log each failed
  // leg so production issues are diagnosable (R3-roles-5).
  if (rolesRes.error) console.error('[permissions.service] roles query failed', { code: rolesRes.error.code });
  if (permsRes.error) console.error('[permissions.service] permissions query failed', { code: permsRes.error.code });
  if (rpRes.error) console.error('[permissions.service] grants query failed', { code: rpRes.error.code });

  const granted: Record<string, string[]> = {};
  for (const row of rpRes.data ?? []) {
    if (!row.role_id || !row.permission_id) continue;
    (granted[row.role_id] ??= []).push(row.permission_id);
  }

  return {
    roles: rolesRes.data ?? [],
    // DB types `category` as plain string; it is a constrained set seeded by migration.
    permissions: (permsRes.data ?? []) as PermissionRow[],
    granted,
  };
}
