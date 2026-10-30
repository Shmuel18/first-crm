'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { israelWallClockToIso } from '@/lib/utils/israel-time';

import { israelDayStart } from '../domain/israel-day';
import { CalendarEventSchema } from '../schemas/calendar-event.schema';

export type SaveCalendarEventResult =
  | { ok: true; id: string }
  | { ok: false; error: 'validation' | 'unauthorized' | 'unknown' };

/**
 * Create or edit a calendar event. Times are Israel wall-clock (the office's
 * "10:00" is 10:00 in Israel wherever the advisor is). Who may put whom on an
 * event is decided by save_calendar_event (manage_team_calendar).
 */
export async function saveCalendarEventAction(input: unknown): Promise<SaveCalendarEventResult> {
  const parsed = CalendarEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const v = parsed.data;

  const startsAt = v.startTime ? israelWallClockToIso(`${v.date}T${v.startTime}`) : israelDayStart(v.date);
  // A multi-day all-day event stores the START of its last day as ends_at.
  const endsAt = v.startTime
    ? v.endTime
      ? israelWallClockToIso(`${v.date}T${v.endTime}`)
      : null
    : v.endDate && v.endDate > v.date
      ? israelDayStart(v.endDate)
      : null;
  if (!startsAt) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data, error } = await supabase.rpc('save_calendar_event', {
    p_id: v.id,
    p_title: v.title,
    p_kind: v.kind,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_all_day: v.startTime === null,
    p_location: v.location,
    p_notes: v.notes,
    p_case_id: v.caseId,
    p_reminder_minutes: v.reminderMinutes,
    p_participant_ids: v.participantIds.length > 0 ? v.participantIds : [userRes.user.id],
  });
  if (error || !data) {
    console.error('[saveCalendarEvent] failed', error?.code);
    return { ok: false, error: error?.code === '42501' ? 'unauthorized' : 'unknown' };
  }
  revalidatePath('/calendar');
  return { ok: true, id: data };
}
