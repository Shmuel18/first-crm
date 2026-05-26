import { createAdminClient } from '@/lib/supabase/admin';

import { sanitizeThresholds } from '@/features/settings/services/sla.service';
import type {
  SlaStatusKey,
  SlaThresholds,
} from '@/features/settings/schemas/sla.schema';
import type { Json } from '@/types/database';

const REPEAT_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type SlaCheckResult = {
  /** How many open status-rows exceeded their configured threshold. */
  overdueRows: number;
  /** How many notification rows were created (after dedupe + recipient fan-out). */
  notificationsCreated: number;
  /** How many overdue rows were skipped because a notification was already
   *  sent for this (case, entered_at) in the last REPEAT_DAYS days. */
  skippedAlreadyNotified: number;
};

type OverdueRow = {
  caseId: string;
  statusId: string;
  statusKey: SlaStatusKey;
  statusNameHe: string;
  statusNameEn: string;
  caseNumber: string;
  assignedAdvisorId: string | null;
  enteredAt: string;
  threshold: number;
  daysInStatus: number;
};

type NotifInsert = {
  user_id: string;
  type: 'case_status_overdue';
  case_id: string;
  data: Json;
};

/** Counts UTC calendar days that have started since the input. Two dates
 *  on the same UTC date return 0; "yesterday" returns 1; "last week" 7.
 *  Calendar-day arithmetic matches operator expectations better than
 *  raw `Math.floor((now-entered)/MS_PER_DAY)` (which counts 24h periods
 *  and so under-reports by 1 when the cron fires earlier than the
 *  entered-at clock time). */
function utcCalendarDaysBetween(earlier: Date, later: Date): number {
  const e = Date.UTC(earlier.getUTCFullYear(), earlier.getUTCMonth(), earlier.getUTCDate());
  const l = Date.UTC(later.getUTCFullYear(), later.getUTCMonth(), later.getUTCDate());
  return Math.floor((l - e) / MS_PER_DAY);
}

/**
 * Daily SLA scan: for each case sitting in a status longer than the
 * configured threshold, create bell notifications for (a) the case's
 * assigned advisor (when still active) and (b) every active admin.
 *
 * Dedupes against any `case_status_overdue` notification already issued
 * for the same (recipient, case_id, entered_at) within the last 7 days
 * — first alert fires when the threshold is first crossed, re-fires
 * once a week until the case leaves the status. Race-safe via the
 * partial UNIQUE index `uq_notifications_overdue_dedupe` (migration 073)
 * which ON CONFLICT DO NOTHING relies on.
 *
 * Uses the admin client to bypass RLS (system-generated rows; the
 * regular `notifications` policies have no INSERT route).
 *
 * Error handling: every Supabase read checks for an error and either
 * throws (caller's catch logs + the cron route returns 500 so Vercel
 * surfaces a failed run) or short-circuits with a clear count. We do
 * NOT silently treat null data as "nothing to alert" — that would
 * mask transient DB outages as "all-clear" and let overdue cases pile
 * up unnoticed.
 */
export async function runSlaCheck(): Promise<SlaCheckResult> {
  const supabase = createAdminClient();

  // 1) Read per-office thresholds. If unset / all empty, nothing to do.
  const { data: settings, error: settingsErr } = await supabase
    .from('office_settings')
    .select('sla_status_thresholds')
    .eq('id', 1)
    .maybeSingle();
  if (settingsErr) throw new Error(`office_settings read failed: ${settingsErr.message}`);
  if (!settings) throw new Error('office_settings id=1 row missing');
  const thresholds: SlaThresholds = sanitizeThresholds(settings.sla_status_thresholds);
  const activeKeys = Object.keys(thresholds) as SlaStatusKey[];
  if (activeKeys.length === 0) {
    return { overdueRows: 0, notificationsCreated: 0, skippedAlreadyNotified: 0 };
  }

  // 2) Map active status keys → status rows (id + names). Filter
  //    is_active=true so the cron and the SLA form agree on which
  //    statuses are live (review #4 — was previously is_terminal-only).
  const { data: statusRows, error: statusErr } = await supabase
    .from('case_statuses')
    .select('id, key, name_he, name_en, is_terminal, is_active')
    .eq('is_active', true)
    .in('key', activeKeys);
  if (statusErr) throw new Error(`case_statuses read failed: ${statusErr.message}`);
  if (!statusRows || statusRows.length === 0) {
    return { overdueRows: 0, notificationsCreated: 0, skippedAlreadyNotified: 0 };
  }
  // Terminal statuses don't get alerts — even if the manager set a threshold.
  const statusById = new Map(
    statusRows.filter((s) => !s.is_terminal).map((s) => [s.id, s] as const),
  );
  const trackedStatusIds = Array.from(statusById.keys());
  if (trackedStatusIds.length === 0) {
    return { overdueRows: 0, notificationsCreated: 0, skippedAlreadyNotified: 0 };
  }

  // 3) All currently-open status rows for tracked statuses.
  //    `exited_at IS NULL` means "case still in this status".
  const { data: openStages, error: stagesErr } = await supabase
    .from('stage_durations')
    .select('case_id, status_id, entered_at')
    .is('exited_at', null)
    .in('status_id', trackedStatusIds);
  if (stagesErr) throw new Error(`stage_durations read failed: ${stagesErr.message}`);
  if (!openStages || openStages.length === 0) {
    return { overdueRows: 0, notificationsCreated: 0, skippedAlreadyNotified: 0 };
  }

  // 4) Resolve overdue rows by comparing days-in-status to the threshold.
  //    "Days" = UTC calendar days that have started since entered_at
  //    (review #10, #14). Matches operator mental model better than
  //    fixed 24h periods, which would under-report by 1 when the cron
  //    fires before the entered-at clock time.
  const nowDate = new Date();
  const overdueByCase = new Map<string, OverdueRow>();
  // A case can in theory have multiple open status rows (shouldn't, but
  // the trigger doesn't constrain it). Keep the most recent entered_at.
  for (const stage of openStages) {
    const status = statusById.get(stage.status_id);
    if (!status) continue;
    const threshold = thresholds[status.key as SlaStatusKey];
    if (!threshold) continue;

    const enteredDate = new Date(stage.entered_at);
    if (!Number.isFinite(enteredDate.getTime())) continue;
    const daysInStatus = utcCalendarDaysBetween(enteredDate, nowDate);
    if (daysInStatus < threshold) continue;

    const existing = overdueByCase.get(stage.case_id);
    if (existing && new Date(existing.enteredAt).getTime() >= enteredDate.getTime()) continue;

    overdueByCase.set(stage.case_id, {
      caseId: stage.case_id,
      statusId: stage.status_id,
      statusKey: status.key as SlaStatusKey,
      statusNameHe: status.name_he,
      statusNameEn: status.name_en,
      caseNumber: '',
      assignedAdvisorId: null,
      enteredAt: stage.entered_at,
      threshold,
      daysInStatus,
    });
  }
  if (overdueByCase.size === 0) {
    return { overdueRows: 0, notificationsCreated: 0, skippedAlreadyNotified: 0 };
  }

  // 5) Pull case metadata (case_number, assigned advisor) and drop
  //    deleted/archived rows — no point alerting on those.
  const overdueCaseIds = Array.from(overdueByCase.keys());
  const { data: caseRows, error: casesErr } = await supabase
    .from('cases')
    .select('id, case_number, assigned_advisor_id, deleted_at, is_archived')
    .in('id', overdueCaseIds);
  if (casesErr) throw new Error(`cases read failed: ${casesErr.message}`);
  const liveCases = new Map<string, { case_number: string; assigned_advisor_id: string | null }>();
  for (const c of caseRows ?? []) {
    if (c.deleted_at) continue;
    if (c.is_archived) continue;
    liveCases.set(c.id, {
      case_number: c.case_number,
      assigned_advisor_id: c.assigned_advisor_id,
    });
  }
  for (const id of overdueCaseIds) {
    const meta = liveCases.get(id);
    if (!meta) {
      overdueByCase.delete(id);
      continue;
    }
    const row = overdueByCase.get(id);
    if (!row) continue;
    row.caseNumber = meta.case_number;
    row.assignedAdvisorId = meta.assigned_advisor_id;
  }
  const overdue = Array.from(overdueByCase.values());
  if (overdue.length === 0) {
    return { overdueRows: 0, notificationsCreated: 0, skippedAlreadyNotified: 0 };
  }

  // 6) Filter assigned advisors by is_active=true (review #11) — deactivated
  //    advisors shouldn't accumulate dead notification rows. Admins are
  //    filtered the same way in step 8.
  const advisorIds = Array.from(
    new Set(
      overdue
        .map((r) => r.assignedAdvisorId)
        .filter((v): v is string => typeof v === 'string'),
    ),
  );
  const activeAdvisors = new Set<string>();
  if (advisorIds.length > 0) {
    const { data: advisorRows, error: advisorErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_active', true)
      .in('id', advisorIds);
    if (advisorErr) throw new Error(`profiles (advisor) read failed: ${advisorErr.message}`);
    for (const a of advisorRows ?? []) activeAdvisors.add(a.id);
  }

  // 7) Active admins — recipients beyond the lead advisor.
  const { data: adminRows, error: adminErr } = await supabase
    .from('profiles')
    .select('id, role:roles!inner(key)')
    .eq('is_active', true)
    .eq('roles.key', 'admin');
  if (adminErr) throw new Error(`profiles (admin) read failed: ${adminErr.message}`);
  const adminIds = (adminRows ?? []).map((r) => r.id);

  // 8) Build the candidate insert set + the corresponding TS-side dedupe
  //    set so we can report skippedAlreadyNotified accurately.
  //    Final dedupe is atomic via the partial UNIQUE index — that's the
  //    authoritative source of truth. This TS-side check just reads
  //    recent notifications so we can split the count between
  //    "tried but already exists" and "actually inserted".
  const since = new Date(nowDate.getTime() - REPEAT_DAYS * MS_PER_DAY).toISOString();
  const { data: recentNotifs, error: recentErr } = await supabase
    .from('notifications')
    .select('user_id, case_id, data')
    .eq('type', 'case_status_overdue')
    .in('case_id', overdueCaseIds)
    .gte('created_at', since);
  if (recentErr) throw new Error(`notifications (recent) read failed: ${recentErr.message}`);

  // Dedupe key INCLUDES user_id (review #6) — without it, a newly-added
  // admin would never get backfill alerts because the existing rows for
  // other recipients would satisfy the dedupe.
  const recentKeys = new Set<string>();
  for (const n of recentNotifs ?? []) {
    if (!n.case_id || !n.user_id) continue;
    const d = (n.data ?? {}) as Record<string, unknown>;
    const enteredAt = typeof d.enteredAt === 'string' ? d.enteredAt : null;
    if (enteredAt) recentKeys.add(`${n.user_id}|${n.case_id}|${enteredAt}`);
  }

  // 9) Fan out one row per (recipient, overdue case), filtering both
  //    the TS-side dedupe and the active-recipient set.
  const inserts: NotifInsert[] = [];
  let skippedByTsDedupe = 0;
  for (const row of overdue) {
    const recipients = new Set<string>(adminIds);
    if (row.assignedAdvisorId && activeAdvisors.has(row.assignedAdvisorId)) {
      recipients.add(row.assignedAdvisorId);
    }
    if (recipients.size === 0) continue;
    for (const userId of recipients) {
      const key = `${userId}|${row.caseId}|${row.enteredAt}`;
      if (recentKeys.has(key)) {
        skippedByTsDedupe += 1;
        continue;
      }
      inserts.push({
        user_id: userId,
        type: 'case_status_overdue',
        case_id: row.caseId,
        data: {
          caseNumber: row.caseNumber,
          statusKey: row.statusKey,
          statusNameHe: row.statusNameHe,
          statusNameEn: row.statusNameEn,
          daysInStatus: row.daysInStatus,
          threshold: row.threshold,
          enteredAt: row.enteredAt,
        },
      });
    }
  }
  if (inserts.length === 0) {
    return {
      overdueRows: overdue.length,
      notificationsCreated: 0,
      skippedAlreadyNotified: skippedByTsDedupe,
    };
  }

  // 10) Atomic bulk insert via RPC (review #5, #9). The RPC iterates
  //     per-row inside a single transaction, ON CONFLICT DO NOTHING via
  //     the partial UNIQUE index — so a concurrent cron's win on the
  //     same key resolves to a skip (not a crash), and one bad FK row
  //     no longer rejects the whole batch.
  const { data: insertedCount, error: rpcErr } = await supabase.rpc(
    'insert_overdue_notifications',
    { p_rows: inserts as unknown as Json },
  );
  if (rpcErr) {
    // Bubble up so the cron route returns 500 and Vercel marks the run
    // as failed — silently masking this as ok=true would let operators
    // miss a multi-day SLA-alerting outage.
    throw new Error(`insert_overdue_notifications failed: ${rpcErr.message}`);
  }

  // The RPC returns the actual count inserted (not the count attempted).
  // Anything attempted-but-not-inserted is either (a) a concurrent-run
  // dedupe win, (b) an FK violation (recipient or case dropped between
  // SELECT and INSERT). Both end up in skippedAlreadyNotified for the
  // report — the caller can compare to inserts.length to detect anomalies.
  const actuallyInserted = insertedCount ?? 0;
  const dbDedupeSkips = inserts.length - actuallyInserted;

  return {
    overdueRows: overdue.length,
    notificationsCreated: actuallyInserted,
    skippedAlreadyNotified: skippedByTsDedupe + dbDedupeSkips,
  };
}
