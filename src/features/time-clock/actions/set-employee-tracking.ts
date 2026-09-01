'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUser, isCurrentUserOwner } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { SetTrackingSchema, type SetTrackingInput } from '../schemas/time-clock.schema';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

/** Owner flags who is an hourly employee (time_tracked) + auto-clock-in. */
export async function setEmployeeTrackingAction(input: SetTrackingInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  if (!(await isCurrentUserOwner())) return { ok: false, error: 'unauthorized' };

  const parsed = SetTrackingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({
      time_tracked: parsed.data.timeTracked,
      auto_clock_in: parsed.data.autoClockIn,
      updated_by: user.id,
    })
    .eq('id', parsed.data.userId);

  if (error) {
    console.error('[time-clock] set tracking error', { code: error.code });
    return { ok: false, error: 'unknown' };
  }

  // The wage lives in its own owner-scoped table (mig 242), so it is a second
  // write. Clearing the rate deletes the row rather than storing NULL — the
  // column is NOT NULL and "no row" is the same thing to every reader.
  const { hourlyRate, userId } = parsed.data;
  const rateError = hourlyRate == null
    ? (await supabase.from('employee_pay_rates').delete().eq('user_id', userId)).error
    : (
        await supabase.from('employee_pay_rates').upsert(
          { user_id: userId, hourly_rate: hourlyRate, updated_by: user.id, created_by: user.id },
          { onConflict: 'user_id' },
        )
      ).error;

  if (rateError) {
    console.error('[time-clock] set pay rate error', { code: rateError.code });
    return { ok: false, error: 'unknown' };
  }

  revalidatePath('/time-clock');
  return { ok: true };
}
