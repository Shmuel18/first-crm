'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

/** Manager soft-deletes a time entry (via the is_admin-gated RPC). */
export async function deleteEntryAction(id: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  if (!z.uuid().safeParse(id).success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('soft_delete_time_entry', { p_id: id });
  if (error) {
    console.error('[time-clock] delete entry error', { code: error.code });
    return { ok: false, error: 'unknown' };
  }

  revalidatePath('/time-clock');
  return { ok: true };
}
