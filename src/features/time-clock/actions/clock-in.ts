'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUser } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { getClockAccess } from '../services/time-clock.service';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'already_open' | 'unknown' };

/** Employee punches IN. Inserts an open shift (clock_in defaults to now()). */
export async function clockInAction(): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { isTracked, isManager } = await getClockAccess();
  if (!isTracked && !isManager) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  const { error } = await supabase.from('time_entries').insert({
    user_id: user.id,
    source: 'manual',
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) {
    // Partial UNIQUE index (one open shift per user) — already clocked in.
    if (error.code === '23505') return { ok: false, error: 'already_open' };
    console.error('[time-clock] clock-in error', { code: error.code });
    return { ok: false, error: 'unknown' };
  }

  revalidatePath('/time-clock');
  return { ok: true };
}
