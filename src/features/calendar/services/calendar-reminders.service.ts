import { resolveCaseLabels } from '@/features/notifications/services/case-label.service';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database, Json } from '@/types/database';

import { israelDayAndTime } from '../domain/israel-day';

type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];

/** How far ahead the cron looks: the longest reminder offered (a day) + slack. */
const MAX_LEAD_MS = 2 * 24 * 60 * 60 * 1000;

/** "29/10 10:00" — or "29/10" for an all-day event. Israel time. */
function formatWhen(startsAt: string, allDay: boolean): string {
  const { day, time } = israelDayAndTime(startsAt);
  const short = `${day.slice(8, 10)}/${day.slice(5, 7)}`;
  return allDay ? short : `${short} ${time}`;
}

/**
 * Rings the bell (and, through the notifications webhook, the email mirror)
 * for calendar events whose reminder time has come: starts_at − reminder_minutes
 * ≤ now, not yet reminded, not already started. One-shot per event via
 * reminded_at (re-armed by save_calendar_event when the time changes).
 * Admin client: system-generated rows for other users.
 */
export async function runCalendarReminders(): Promise<{ due: number; notified: number }> {
  const admin = createAdminClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const { data: events, error } = await admin
    .from('calendar_events')
    .select('id, title, starts_at, all_day, case_id, reminder_minutes, created_by, calendar_event_participants(user_id)')
    .is('deleted_at', null)
    .is('reminded_at', null)
    .not('reminder_minutes', 'is', null)
    .gt('starts_at', nowIso)
    .lte('starts_at', new Date(now + MAX_LEAD_MS).toISOString());
  if (error) throw new Error(`calendar_events read failed: ${error.message}`);

  const due = (events ?? []).filter(
    (e) => Date.parse(e.starts_at) - (e.reminder_minutes ?? 0) * 60_000 <= now,
  );
  if (due.length === 0) return { due: 0, notified: 0 };

  const labels = await resolveCaseLabels(admin, due.map((e) => e.case_id));
  const inserts: NotificationInsert[] = due.flatMap((e) => {
    const recipients = e.calendar_event_participants?.map((p) => p.user_id) ?? [];
    const to = recipients.length > 0 ? recipients : e.created_by ? [e.created_by] : [];
    const data = {
      title: e.title,
      when: formatWhen(e.starts_at, e.all_day),
      caseLabel: e.case_id ? (labels.get(e.case_id)?.label ?? null) : null,
    };
    return to.map((user_id) => ({
      user_id,
      type: 'calendar_reminder',
      case_id: e.case_id,
      data: data as Json, // plain JSON object; the column type is Json
    }));
  });

  // Mark first: a failed insert then skips one reminder rather than repeating
  // it every 15 minutes forever.
  const { error: markErr } = await admin
    .from('calendar_events')
    .update({ reminded_at: nowIso })
    .in('id', due.map((e) => e.id));
  if (markErr) throw new Error(`calendar_events mark failed: ${markErr.message}`);

  if (inserts.length > 0) {
    const { error: insertErr } = await admin.from('notifications').insert(inserts);
    if (insertErr) throw new Error(`calendar_reminder insert failed: ${insertErr.message}`);
  }
  return { due: due.length, notified: inserts.length };
}
