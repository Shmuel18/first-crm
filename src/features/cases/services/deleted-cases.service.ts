import { createClient } from '@/lib/supabase/server';

const DEFAULT_RETENTION_DAYS = 14;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type DeletedCaseRow = {
  id: string;
  caseNumber: string;
  statusNameHe: string | null;
  statusNameEn: string | null;
  statusColor: string | null;
  primaryBorrowerFirstName: string | null;
  primaryBorrowerLastName: string | null;
  assignedAdvisorFirstName: string | null;
  assignedAdvisorLastName: string | null;
  deletedAt: string;
  deletedByFirstName: string | null;
  deletedByLastName: string | null;
  /** Days remaining until the retention sweep hard-deletes this row. 0 = expires today. */
  daysUntilPurge: number;
};

type DeletedCaseRpcRow = {
  id: string;
  case_number: string;
  deleted_at: string;
  status_name_he: string | null;
  status_name_en: string | null;
  status_color: string | null;
  primary_borrower_first_name: string | null;
  primary_borrower_last_name: string | null;
  assigned_advisor_first_name: string | null;
  assigned_advisor_last_name: string | null;
  deleted_by_first_name: string | null;
  deleted_by_last_name: string | null;
};

export type DeletedCasesResult = {
  rows: DeletedCaseRow[];
  /** When the retention purge is paused (mig 173), NOTHING is auto-deleted, so
   *  the UI shows every soft-deleted case and hides the misleading countdown. */
  retentionPaused: boolean;
};

/**
 * Lists soft-deleted cases. While the retention purge is paused (mig 173) every
 * soft-deleted case is shown (no auto-purge is happening); otherwise only those
 * still inside the office's retention window. The DB RPC is admin-scoped and
 * avoids app-side service-role access.
 */
export async function listDeletedCases(): Promise<DeletedCasesResult> {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from('office_settings')
    .select('deleted_records_retention_days')
    .eq('id', 1)
    .maybeSingle();
  const retentionDays =
    settings?.deleted_records_retention_days ?? DEFAULT_RETENTION_DAYS;

  // retention_purge_enabled (mig 173) predates the generated types; minimal cast.
  const { data: flagRow } = await (
    supabase as unknown as {
      from: (t: 'office_settings') => {
        select: (c: 'retention_purge_enabled') => {
          eq: (col: 'id', v: number) => {
            maybeSingle: () => PromiseLike<{ data: { retention_purge_enabled: boolean | null } | null }>;
          };
        };
      };
    }
  )
    .from('office_settings')
    .select('retention_purge_enabled')
    .eq('id', 1)
    .maybeSingle();
  // Fail safe: treat unknown as paused (don't imply an active countdown).
  const retentionPaused = flagRow?.retention_purge_enabled !== true;

  // Paused → show ALL soft-deleted cases (epoch cutoff); else the active window.
  const cutoffIso = retentionPaused
    ? new Date(0).toISOString()
    : new Date(Date.now() - retentionDays * MS_PER_DAY).toISOString();

  const { data, error } = await supabase.rpc('list_deleted_cases', {
    p_cutoff: cutoffIso,
  });
  if (error) {
    console.error('[listDeletedCases] query failed', { message: error.message });
    return { rows: [], retentionPaused };
  }

  const now = Date.now();
  const rows = ((data ?? []) as DeletedCaseRpcRow[]).map((c) => {
    const deletedMs = new Date(c.deleted_at).getTime();
    const ageDays = Math.floor((now - deletedMs) / MS_PER_DAY);
    const remaining = Math.max(0, retentionDays - ageDays);
    return {
      id: c.id,
      caseNumber: c.case_number,
      statusNameHe: c.status_name_he,
      statusNameEn: c.status_name_en,
      statusColor: c.status_color,
      primaryBorrowerFirstName: c.primary_borrower_first_name,
      primaryBorrowerLastName: c.primary_borrower_last_name,
      assignedAdvisorFirstName: c.assigned_advisor_first_name,
      assignedAdvisorLastName: c.assigned_advisor_last_name,
      deletedAt: c.deleted_at,
      deletedByFirstName: c.deleted_by_first_name,
      deletedByLastName: c.deleted_by_last_name,
      daysUntilPurge: remaining,
    };
  });
  return { rows, retentionPaused };
}
