import { createClient } from '@/lib/supabase/server';

/**
 * Raw reads for each calendar layer, all under the CALLER'S RLS — an advisor
 * sees exactly the cases / tasks / events they can already open. Range bounds:
 * `fromDay`/`toDay` are civil days (date columns), `fromIso`/`toIso` the
 * matching Israel instants (timestamp columns). `to` is exclusive.
 */
export type CalendarRangeBounds = { fromDay: string; toDay: string; fromIso: string; toIso: string };

type Db = Awaited<ReturnType<typeof createClient>>;

export async function readTargetDates(db: Db, r: CalendarRangeBounds) {
  const { data } = await db
    .from('cases')
    .select('id, target_date, status:case_statuses(key)')
    .is('deleted_at', null)
    .eq('is_archived', false)
    .gte('target_date', r.fromDay)
    .lt('target_date', r.toDay);
  return data ?? [];
}

export async function readOpenedCases(db: Db, r: CalendarRangeBounds) {
  const { data } = await db
    .from('cases')
    .select('id, opened_at')
    .is('deleted_at', null)
    .gte('opened_at', r.fromDay)
    .lt('opened_at', r.toDay);
  return data ?? [];
}

export async function readTasks(db: Db, r: CalendarRangeBounds) {
  const { data } = await db
    .from('tasks')
    .select('id, title, due_date, case_id, assigned_to, created_by, status')
    .is('deleted_at', null)
    .neq('status', 'completed')
    .gte('due_date', r.fromIso)
    .lt('due_date', r.toIso);
  return data ?? [];
}

export async function readStageEntries(db: Db, r: CalendarRangeBounds) {
  const { data: inRange } = await db
    .from('stage_durations')
    .select('case_id, status_id, entered_at')
    .gte('entered_at', r.fromIso)
    .lt('entered_at', r.toIso);
  const caseIds = [...new Set((inRange ?? []).map((e) => e.case_id))];
  if (caseIds.length === 0) return [];
  // The whole history up to the range end, so the first change in range can
  // still be judged against the stage before it.
  const { data } = await db
    .from('stage_durations')
    .select('case_id, status_id, entered_at')
    .in('case_id', caseIds)
    .lt('entered_at', r.toIso);
  return data ?? [];
}

export async function readDocumentExpiries(db: Db, r: CalendarRangeBounds) {
  const { data } = await db
    .from('documents')
    .select('id, file_name, case_id, expiry_date')
    .is('deleted_at', null)
    .gte('expiry_date', r.fromDay)
    .lt('expiry_date', r.toDay);
  return data ?? [];
}

export async function readIdExpiries(db: Db, r: CalendarRangeBounds) {
  const { data } = await db
    .from('borrowers')
    .select('id, first_name, last_name, id_expiry_date, case_borrowers(case_id)')
    .is('deleted_at', null)
    .gte('id_expiry_date', r.fromDay)
    .lt('id_expiry_date', r.toDay);
  return data ?? [];
}

export async function readAgreements(db: Db, r: CalendarRangeBounds) {
  const cols = 'id, case_id, status, sent_at, signed_at, expires_at' as const;
  const [sent, signed, expiring] = await Promise.all([
    db.from('case_agreements').select(cols).gte('sent_at', r.fromIso).lt('sent_at', r.toIso),
    db.from('case_agreements').select(cols).gte('signed_at', r.fromIso).lt('signed_at', r.toIso),
    db.from('case_agreements').select(cols).gte('expires_at', r.fromIso).lt('expires_at', r.toIso),
  ]);
  return { sent: sent.data ?? [], signed: signed.data ?? [], expiring: expiring.data ?? [] };
}

export async function readEvents(db: Db, r: CalendarRangeBounds) {
  const { data } = await db
    .from('calendar_events')
    .select(
      'id, title, kind, starts_at, ends_at, all_day, location, notes, case_id, reminder_minutes, calendar_event_participants(user_id)',
    )
    .is('deleted_at', null)
    .lt('starts_at', r.toIso)
    // Overlaps the range: starts inside it, or a multi-day span still running.
    .or(`starts_at.gte."${r.fromIso}",ends_at.gte."${r.fromIso}"`);
  return data ?? [];
}

/** Case number + client names + the responsible and associated advisors, for every referenced case. */
export async function readCaseLabels(db: Db, caseIds: ReadonlyArray<string>) {
  const ids = [...new Set(caseIds)];
  if (ids.length === 0) return [];
  const { data } = await db
    .from('cases')
    .select(
      'id, case_number, assigned_advisor_id, case_associated_advisors(advisor_id), case_borrowers(is_primary, borrower:borrowers(first_name, last_name))',
    )
    .in('id', ids);
  return data ?? [];
}

export async function readStatusOrder(db: Db) {
  const { data } = await db.from('case_statuses').select('id, name_he, name_en, sort_order');
  return data ?? [];
}
