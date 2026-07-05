'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { UpsertEntrySchema, type UpsertEntryInput } from '../schemas/time-clock.schema';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'already_open' | 'unknown' };

/** Manager creates or corrects a single time entry for any employee. */
export async function upsertEntryAction(input: UpsertEntryInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const parsed = UpsertEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { id, userId, clockIn, clockOut, note } = parsed.data;

  const supabase = await createClient();
  const values = {
    clock_in: new Date(clockIn).toISOString(),
    clock_out: clockOut ? new Date(clockOut).toISOString() : null,
    note: note?.trim() || null,
    updated_by: user.id,
  };

  const { error } = id
    ? await supabase.from('time_entries').update(values).eq('id', id)
    : await supabase
        .from('time_entries')
        .insert({ ...values, user_id: userId, source: 'manual', created_by: user.id });

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'already_open' };
    console.error('[time-clock] upsert entry error', { code: error.code });
    return { ok: false, error: 'unknown' };
  }

  revalidatePath('/time-clock');
  return { ok: true };
}
