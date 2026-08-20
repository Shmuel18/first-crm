import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

export type DeletedMemberMatch = { id: string; name: string };

/**
 * A previously-removed member holding this address. "Delete" is a soft delete
 * (the profiles row is kept so audit rows and closed cases stay attributed),
 * but the auth user survives too — so re-inviting the same person fails with
 * "email already registered" and the admin has no way forward. Finding the
 * tombstone lets the invite dialog offer a restore instead of a dead end.
 *
 * Runs under the caller's RLS: only an admin (profiles_admin_all) sees other
 * people's rows, so this can't be used to probe addresses.
 */
export async function findDeletedMemberByEmail(
  supabase: SupabaseClient<Database>,
  email: string,
): Promise<DeletedMemberMatch | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .ilike('email', email)
    .not('deleted_at', 'is', null)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
  return { id: data.id, name };
}
