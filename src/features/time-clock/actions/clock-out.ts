'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUser } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { ClockOutSchema, type ClockOutInput } from '../schemas/time-clock.schema';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'not_open' | 'unknown' };

/** Employee punches OUT: closes their currently-open shift. */
export async function clockOutAction(input?: ClockOutInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const parsed = ClockOutSchema.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, error: 'validation' };

  const note = parsed.data.note?.trim();
  const patch: { clock_out: string; updated_by: string; note?: string } = {
    clock_out: new Date().toISOString(),
    updated_by: user.id,
  };
  if (note) patch.note = note;

  const supabase = await createClient();
  // RLS restricts an employee to closing their OWN open shift.
  const { data, error } = await supabase
    .from('time_entries')
    .update(patch)
    .eq('user_id', user.id)
    .is('clock_out', null)
    .is('deleted_at', null)
    .select('id');

  if (error) {
    console.error('[time-clock] clock-out error', { code: error.code });
    return { ok: false, error: 'unknown' };
  }
  if (!data || data.length === 0) return { ok: false, error: 'not_open' };

  revalidatePath('/time-clock');
  return { ok: true };
}
