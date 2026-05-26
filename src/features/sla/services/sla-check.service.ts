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

/**
 * Daily SLA scan: for each case sitting in a status longer than the
 * configured threshold, create bell notifications for (a) the case's
 * assigned advisor and (b) every active admin. Dedupes against any
 * `case_status_overdue` notification already issued for the same
 * (case_id, entered_at) within the last 7 days — so a "first" alert
 * fires when the threshold is first crossed, then re-fires once a week
 * until the case leaves the status.
 *
 * Uses the admin client to bypass RLS (system-generated rows; the
 * regular `notifications` policies have no INSERT route).
 */
export async function runSlaCheck(): Promise<SlaCheckResult> {
  const supabase = createAdminClient();

  // 1) Read per-office thresholds. If unset / all empty, nothing to do.
  const { data: settings } = await supabase
    .from('office_settings')
    .select('sla_status_thresholds')
    .eq('id', 1)
    .single();
  const thresholds: SlaThresholds = sanitizeThresholds(settings?.sla_status_thresholds);
  const activeKeys = Object.keys(thresholds) as SlaStatusKey[];
  if (activeKeys.length === 0) {
    return { overdueRows: 0, notificationsCreated: 0, skippedAlreadyNotified: 0 };
  }

  // 2) Map active status keys → status rows (id + names).
  const { data: statusRows } = await supabase
    .from('case_statuses')
    .select('id, key, name_he, name_en, is_terminal')
    .in('key', activeKeys);
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
  const { data: openStages } = await supabase
    .from('stage_durations')
    .select('case_id, status_id, entered_at')
    .is('exited_at', null)
    .in('status_id', trackedStatusIds);
  if (!openStages || openStages.length === 0) {
    return { overdueRows: 0, notificationsCreated: 0, skippedAlreadyNotified: 0 };
  }

  // 4) Resolve overdue rows by comparing days-in-status to the threshold.
  const now = Date.now();
  const overdueByCase = new Map<string, OverdueRow>();
  // A case can in theory have multiple open status rows (shouldn't, but
  // the trigger doesn't constrain it). Keep the most recent entered_at.
  for (const stage of openStages) {
    const status = statusById.get(stage.status_id);
    if (!status) continue;
    const threshold = thresholds[status.key as SlaStatusKey];
    if (!threshold) continue;

    const enteredMs = new Date(stage.entered_at).getTime();
    if (!Number.isFinite(enteredMs)) continue;
    const daysInStatus = Math.floor((now - enteredMs) / MS_PER_DAY);
    if (daysInStatus < threshold) continue;

    const existing = overdueByCase.get(stage.case_id);
    if (existing && new Date(existing.enteredAt).getTime() >= enteredMs) continue;

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
  const { data: caseRows } = await supabase
    .from('cases')
    .select('id, case_number, assigned_advisor_id, deleted_at, is_archived')
    .in('id', overdueCaseIds);
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

  // 6) Dedupe — has a notification already gone out for this
  //    (case_id, entered_at) in the past REPEAT_DAYS days?
  const since = new Date(now - REPEAT_DAYS * MS_PER_DAY).toISOString();
  const { data: recentNotifs } = await supabase
    .from('notifications')
    .select('case_id, data')
    .eq('type', 'case_status_overdue')
    .in('case_id', overdueCaseIds)
    .gte('created_at', since);

  const recentKeys = new Set<string>();
  for (const n of recentNotifs ?? []) {
    if (!n.case_id) continue;
    const d = (n.data ?? {}) as Record<string, unknown>;
    const enteredAt = typeof d.enteredAt === 'string' ? d.enteredAt : null;
    if (enteredAt) recentKeys.add(`${n.case_id}|${enteredAt}`);
  }

  const needsNotify = overdue.filter(
    (r) => !recentKeys.has(`${r.caseId}|${r.enteredAt}`),
  );
  const skipped = overdue.length - needsNotify.length;
  if (needsNotify.length === 0) {
    return { overdueRows: overdue.length, notificationsCreated: 0, skippedAlreadyNotified: skipped };
  }

  // 7) Active admins — recipients beyond the lead advisor.
  const { data: adminRows } = await supabase
    .from('profiles')
    .select('id, role:roles!inner(key)')
    .eq('is_active', true)
    .eq('roles.key', 'admin');
  const adminIds = (adminRows ?? []).map((r) => r.id);

  // 8) Fan out one row per (recipient, overdue case), dedupe per case.
  const inserts: NotifInsert[] = [];
  for (const row of needsNotify) {
    const recipients = new Set<string>(adminIds);
    if (row.assignedAdvisorId) recipients.add(row.assignedAdvisorId);
    if (recipients.size === 0) continue;
    for (const userId of recipients) {
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
    return { overdueRows: overdue.length, notificationsCreated: 0, skippedAlreadyNotified: skipped };
  }

  const { error: insertError } = await supabase.from('notifications').insert(inserts);
  if (insertError) {
    console.error('[sla-check] insert failed', { message: insertError.message });
    return { overdueRows: overdue.length, notificationsCreated: 0, skippedAlreadyNotified: skipped };
  }

  return {
    overdueRows: overdue.length,
    notificationsCreated: inserts.length,
    skippedAlreadyNotified: skipped,
  };
}
