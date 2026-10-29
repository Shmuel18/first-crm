import { getCaseClientLabel } from '@/features/cases/domain/case-derivations';
import { createClient } from '@/lib/supabase/server';
import { israelWallClockNow } from '@/lib/utils/israel-time';

import { calendarCaseLabel } from '../domain/case-labels';
import { israelDayAndTime, israelDayStart } from '../domain/israel-day';
import { stageDirections } from '../domain/stage-direction';
import { isEventKind } from '../domain/event-kind';
import type { CalendarEventRecord, CalendarItem } from '../types';

import {
  readAgreements,
  readCaseLabels,
  readDocumentExpiries,
  readEvents,
  readIdExpiries,
  readOpenedCases,
  readStageEntries,
  readStatusOrder,
  readTargetDates,
  readTasks,
  type CalendarRangeBounds,
} from './calendar-sources.service';

export type CalendarFeed = {
  items: CalendarItem[];
  /** Full event records, keyed by id, for the edit dialog. */
  events: Record<string, CalendarEventRecord>;
};

type CaseInfo = { label: string; advisorId: string | null };

/**
 * Every calendar item in [fromDay, toDay) the caller may see. Item titles are
 * raw data (task title, file name, status name); the UI adds the translated
 * prefix per layer from `layer` + `detail`.
 */
export async function getCalendarFeed(
  fromDay: string,
  toDay: string,
  locale: 'he' | 'en',
): Promise<CalendarFeed> {
  const db = await createClient();
  const r: CalendarRangeBounds = { fromDay, toDay, fromIso: israelDayStart(fromDay), toIso: israelDayStart(toDay) };
  const [targets, opened, tasks, stages, docs, ids, agreements, events, statuses] = await Promise.all([
    readTargetDates(db, r),
    readOpenedCases(db, r),
    readTasks(db, r),
    readStageEntries(db, r),
    readDocumentExpiries(db, r),
    readIdExpiries(db, r),
    readAgreements(db, r),
    readEvents(db, r),
    readStatusOrder(db),
  ]);

  const referenced = [
    ...targets.map((c) => c.id),
    ...opened.map((c) => c.id),
    ...tasks.flatMap((t) => (t.case_id ? [t.case_id] : [])),
    ...stages.map((s) => s.case_id),
    ...docs.flatMap((d) => (d.case_id ? [d.case_id] : [])),
    ...ids.flatMap((b) => b.case_borrowers?.map((cb) => cb.case_id) ?? []),
    ...[...agreements.sent, ...agreements.signed, ...agreements.expiring].map((a) => a.case_id),
    ...events.flatMap((e) => (e.case_id ? [e.case_id] : [])),
  ];
  const cases = new Map<string, CaseInfo>(
    (await readCaseLabels(db, referenced)).map((c) => [
      c.id,
      { label: calendarCaseLabel(getCaseClientLabel(c), c.case_number), advisorId: c.assigned_advisor_id },
    ]),
  );
  const caseOf = (id: string | null) => (id ? (cases.get(id) ?? null) : null);
  const base = (caseId: string | null) => {
    const c = caseOf(caseId);
    return {
      caseId,
      caseLabel: c?.label ?? null,
      advisorIds: c?.advisorId ? [c.advisorId] : [],
      href: caseId ? `/cases/${caseId}` : null,
      endTime: null,
    };
  };

  const today = israelWallClockNow().slice(0, 10);
  const nowIso = new Date().toISOString();
  const items: CalendarItem[] = [];

  for (const c of targets) {
    if (!c.target_date) continue;
    items.push({
      ...base(c.id),
      key: `target:${c.id}`,
      layer: 'targetDate',
      day: c.target_date,
      time: null,
      title: caseOf(c.id)?.label ?? '',
      detail: null,
      overdue: c.target_date < today,
      editable: { kind: 'targetDate', caseId: c.id },
    });
  }

  for (const c of opened) {
    if (!c.opened_at) continue;
    items.push({ ...base(c.id), key: `opened:${c.id}`, layer: 'opened', day: c.opened_at, time: null, title: caseOf(c.id)?.label ?? '', detail: null, editable: null });
  }

  for (const t of tasks) {
    if (!t.due_date) continue;
    const { day, time } = israelDayAndTime(t.due_date);
    const owner = t.assigned_to ?? t.created_by;
    items.push({
      ...base(t.case_id),
      advisorIds: owner ? [owner] : [],
      key: `task:${t.id}`,
      layer: 'task',
      day,
      time: time === '00:00' ? null : time,
      title: t.title,
      detail: null,
      overdue: t.due_date < nowIso,
      editable: { kind: 'task', taskId: t.id },
      href: `/tasks?thread=${encodeURIComponent(t.id)}`,
    });
  }

  const statusById = new Map(statuses.map((s) => [s.id, s]));
  const entries = stages.map((s) => ({ caseId: s.case_id, statusId: s.status_id, enteredAt: s.entered_at }));
  const directions = stageDirections(entries, new Map(statuses.map((s) => [s.id, s.sort_order])));
  for (const e of entries) {
    if (e.enteredAt < r.fromIso) continue; // history only used for direction
    const { day, time } = israelDayAndTime(e.enteredAt);
    const status = statusById.get(e.statusId);
    items.push({
      ...base(e.caseId),
      key: `stage:${e.caseId}:${e.enteredAt}`,
      layer: 'stage',
      day,
      time,
      // "אושר עקרונית · #2026-044 · גולד יעקב" — the stage, then whose case.
      title: [(locale === 'he' ? status?.name_he : status?.name_en) ?? '', caseOf(e.caseId)?.label]
        .filter(Boolean)
        .join(' · '),
      detail: null,
      direction: directions.get(e),
      editable: null,
    });
  }

  for (const d of docs) {
    if (!d.expiry_date) continue;
    items.push({ ...base(d.case_id), key: `doc:${d.id}`, layer: 'expiry', day: d.expiry_date, time: null, title: d.file_name, detail: 'document', editable: null });
  }
  for (const b of ids) {
    if (!b.id_expiry_date) continue;
    const caseId = b.case_borrowers?.[0]?.case_id ?? null;
    const name = [b.last_name, b.first_name].filter(Boolean).join(' ');
    items.push({ ...base(caseId), key: `id:${b.id}`, layer: 'expiry', day: b.id_expiry_date, time: null, title: name, detail: 'id', editable: null });
  }

  const agreementItems: Array<[typeof agreements.sent, 'sent' | 'signed' | 'expires', 'sent_at' | 'signed_at' | 'expires_at']> = [
    [agreements.sent, 'sent', 'sent_at'],
    [agreements.signed, 'signed', 'signed_at'],
    [agreements.expiring, 'expires', 'expires_at'],
  ];
  for (const [rows, what, col] of agreementItems) {
    for (const a of rows) {
      const at = a[col];
      if (!at || (what === 'expires' && a.status === 'signed')) continue;
      const { day, time } = israelDayAndTime(at);
      items.push({ ...base(a.case_id), key: `agreement:${a.id}:${what}`, layer: 'agreement', day, time: what === 'expires' ? null : time, title: caseOf(a.case_id)?.label ?? '', detail: what, editable: null });
    }
  }

  const eventRecords: Record<string, CalendarEventRecord> = {};
  for (const e of events) {
    const start = israelDayAndTime(e.starts_at);
    const participants = e.calendar_event_participants?.map((p) => p.user_id) ?? [];
    eventRecords[e.id] = {
      id: e.id,
      title: e.title,
      kind: isEventKind(e.kind) ? e.kind : 'other',
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      allDay: e.all_day,
      location: e.location,
      notes: e.notes,
      caseId: e.case_id,
      reminderMinutes: e.reminder_minutes,
      participantIds: participants,
    };
    items.push({
      ...base(e.case_id),
      advisorIds: participants,
      key: `event:${e.id}`,
      layer: 'event',
      day: start.day,
      time: e.all_day ? null : start.time,
      endTime: !e.all_day && e.ends_at ? israelDayAndTime(e.ends_at).time : null,
      title: e.title,
      detail: e.kind,
      editable: { kind: 'event', eventId: e.id },
    });
  }

  return { items, events: eventRecords };
}
