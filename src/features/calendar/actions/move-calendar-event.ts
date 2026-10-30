'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

import { israelWallClockToIso } from '@/lib/utils/israel-time';

import { addDays, daysBetween } from '../domain/calendar-range';
import { israelDayAndTime, israelDayStart } from '../domain/israel-day';

type Result = { ok: true } | { ok: false; error: 'validation' | 'unauthorized' | 'unknown' };

const MoveSchema = z.object({ eventId: z.uuid(), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/** Move an event to start on another day, keeping its time of day and length. */
export async function moveCalendarEventAction(eventId: string, day: string): Promise<Result> {
  const parsed = MoveSchema.safeParse({ eventId, day });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: ev } = await supabase
    .from('calendar_events')
    .select('id, title, kind, starts_at, ends_at, all_day, location, notes, case_id, reminder_minutes, calendar_event_participants(user_id)')
    .eq('id', parsed.data.eventId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!ev) return { ok: false, error: 'unauthorized' };

  // Re-anchor on the Israel wall clock ("10:00" stays 10:00 across a DST
  // change), then keep the event's length.
  const from = israelDayAndTime(ev.starts_at);
  if (from.day === parsed.data.day) return { ok: true };
  const startsAt = ev.all_day
    ? israelDayStart(parsed.data.day)
    : israelWallClockToIso(`${parsed.data.day}T${from.time}`);
  if (!startsAt) return { ok: false, error: 'validation' };
  // An all-day span moves by whole days (its ends_at is the start of its last
  // day); a timed event keeps its length.
  const endsAt = !ev.ends_at
    ? null
    : ev.all_day
      ? israelDayStart(addDays(parsed.data.day, daysBetween(from.day, israelDayAndTime(ev.ends_at).day)))
      : new Date(Date.parse(startsAt) + Date.parse(ev.ends_at) - Date.parse(ev.starts_at)).toISOString();

  const { error } = await supabase.rpc('save_calendar_event', {
    p_id: ev.id,
    p_title: ev.title,
    p_kind: ev.kind,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_all_day: ev.all_day,
    p_location: ev.location,
    p_notes: ev.notes,
    p_case_id: ev.case_id,
    p_reminder_minutes: ev.reminder_minutes,
    p_participant_ids: ev.calendar_event_participants?.map((p) => p.user_id) ?? [],
  });
  if (error) {
    console.error('[moveCalendarEvent] failed', error.code);
    return { ok: false, error: error.code === '42501' ? 'unauthorized' : 'unknown' };
  }
  revalidatePath('/calendar');
  return { ok: true };
}
