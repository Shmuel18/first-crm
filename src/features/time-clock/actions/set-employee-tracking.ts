'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { SetTrackingSchema, type SetTrackingInput } from '../schemas/time-clock.schema';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

/** Manager flags who is an hourly employee (time_tracked) + auto-clock-in. */
export async function setEmployeeTrackingAction(input: SetTrackingInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

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

  revalidatePath('/time-clock');
  return { ok: true };
}
