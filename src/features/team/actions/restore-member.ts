'use server';

import { revalidatePath } from 'next/cache';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { safeDbError } from '@/lib/supabase/db-error-log';

import { RestoreMemberSchema } from '../schemas/team.schema';
import type { RestoreMemberResult } from '../types';

/**
 * Bring a soft-deleted member back into the team. The counterpart to
 * admin_delete_member: that RPC reassigned their work and stamped
 * profiles.deleted_at, leaving the auth user in place — so a fresh invite for
 * the same address is refused as "already registered". This clears the
 * tombstone and re-applies the details the admin just typed (name, phone,
 * role), which may differ from what they had before.
 *
 * Their old cases and tasks are NOT taken back — they were reassigned to an
 * admin on delete and stay there; the office re-assigns deliberately.
 *
 * Deliberately does NOT mint a login link: `needsInvite` tells the caller the
 * member never completed onboarding, and the existing resend-invite path (with
 * its impersonation guard) issues the link.
 */
export async function restoreMemberAction(input: unknown): Promise<RestoreMemberResult> {
  const parsed = RestoreMemberSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) return { ok: false, error: 'unauthorized' };

  const { userId, first_name, last_name, phone, role_id } = parsed.data;

  // Must actually be a removed member — restoring an active one would be a
  // silent role/name overwrite from a dialog that never showed those values.
  const { data: target } = await supabase
    .from('profiles')
    .select('id, deleted_at')
    .eq('id', userId)
    .maybeSingle();
  if (!target || target.deleted_at === null) return { ok: false, error: 'not_found' };

  // Request-scoped client on purpose: the audit trigger attributes the
  // restore (and the role it grants) to the acting admin.
  const { error } = await supabase
    .from('profiles')
    .update({
      deleted_at: null,
      is_active: true,
      first_name,
      last_name,
      phone: phone ?? null,
      role_id,
    })
    .eq('id', userId);
  if (error) {
    console.error('[restoreMember] update failed', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }

  // Never signed in → they still need a set-password link. Already signed in →
  // their old password works and no link should be minted.
  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(userId);

  revalidatePath('/team');
  revalidatePath('/settings/people');
  return { ok: true, userId, needsInvite: !authUser?.user?.last_sign_in_at };
}
