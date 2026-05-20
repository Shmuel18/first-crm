import { createClient } from '@/lib/supabase/server';

/**
 * Server-side permission check helper.
 *
 * RLS already gates the actual DB writes, so calling this in a Server Action
 * is defense-in-depth: it lets us fail fast with a clean unauthorized
 * response BEFORE we start uploading blobs / writing audit rows. Without
 * it, callers see the eventual RLS rejection which surfaces as a generic
 * "unknown" error.
 *
 * Always uses the request-scoped Supabase client so it honors the caller's
 * session and the has_permission() function evaluates against THEIR roles.
 */
export async function userHasPermission(permKey: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('has_permission', { perm_key: permKey });
  if (error) {
    console.error('has_permission RPC failed', { permKey, err: error.message });
    return false;
  }
  return data === true;
}

/** True if either of the two permissions is granted. */
export async function userHasAnyPermission(...keys: string[]): Promise<boolean> {
  for (const k of keys) {
    if (await userHasPermission(k)) return true;
  }
  return false;
}

export async function userHasAllPermissions(...keys: string[]): Promise<boolean> {
  for (const k of keys) {
    if (!(await userHasPermission(k))) return false;
  }
  return true;
}

/** True if the current user has the admin role (wraps the is_admin RPC). */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('is_admin');
  return data === true;
}

export async function userCanEditCase(caseId: string): Promise<boolean> {
  const supabase = await createClient();

  if (await userHasPermission('edit_any_case')) return true;
  if (!(await userHasPermission('edit_own_case'))) return false;

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return false;

  const { data, error } = await supabase
    .from('cases')
    .select('assigned_advisor_id')
    .eq('id', caseId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.error('case edit permission check failed', { caseId, err: error.message });
    return false;
  }

  return data?.assigned_advisor_id === userRes.user.id;
}
