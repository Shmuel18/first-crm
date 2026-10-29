'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'unknown' };

/** Soft-delete an event (creator, participant, or manage_team_calendar). */
export async function deleteCalendarEventAction(eventId: string): Promise<Result> {
  const id = z.uuid().safeParse(eventId);
  if (!id.success) return { ok: false, error: 'unknown' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data, error } = await supabase.rpc('delete_calendar_event', { p_id: id.data });
  if (error) {
    console.error('[deleteCalendarEvent] failed', error.code);
    return { ok: false, error: 'unknown' };
  }
  if (data !== true) return { ok: false, error: 'unauthorized' };
  revalidatePath('/calendar');
  return { ok: true };
}
