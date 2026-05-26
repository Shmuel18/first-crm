import { createAdminClient } from '@/lib/supabase/admin';
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

type RawCaseRow = {
  id: string;
  case_number: string;
  deleted_at: string;
  status: { name_he: string; name_en: string; color: string } | null;
  assigned_advisor:
    | { first_name: string | null; last_name: string | null }
    | null;
  case_borrowers: ReadonlyArray<{
    is_primary: boolean;
    borrower: { first_name: string | null; last_name: string | null } | null;
  }>;
};

type AuditRow = {
  record_id: string;
  user_id: string | null;
  timestamp: string;
  user: { first_name: string | null; last_name: string | null } | null;
};

/**
 * Lists soft-deleted cases still inside the office's retention window.
 * Source of "deleted by" is the audit_log SOFT_DELETE entry (no denormalized
 * column on cases). We pull cases + audit rows in two parallel queries and
 * join in memory — keeps RLS / column-selection sane and avoids a fragile
 * `auth.uid()` correlated subquery via PostgREST.
 *
 * Retention window comes from `office_settings.deleted_records_retention_days`
 * (default 14). Anything older has already been (or will soon be) hard-deleted
 * by the `cleanup_soft_deleted_records` sweep (migration 022) and is filtered
 * out here.
 */
export async function listDeletedCases(): Promise<DeletedCaseRow[]> {
  const session = await createClient();

  const { data: settings } = await session
    .from('office_settings')
    .select('deleted_records_retention_days')
    .eq('id', 1)
    .maybeSingle();
  const retentionDays =
    settings?.deleted_records_retention_days ?? DEFAULT_RETENTION_DAYS;
  const cutoffIso = new Date(Date.now() - retentionDays * MS_PER_DAY).toISOString();

  // Cases SELECT policy (migration 011) filters `deleted_at IS NULL`, so the
  // session client returns ZERO soft-deleted rows. The recycle-bin page is
  // admin-only — the route guard verifies that BEFORE calling this — so
  // bypassing RLS here is safe and necessary to see the rows we need to show.
  const supabase = createAdminClient();

  const casesQuery = supabase
    .from('cases')
    .select(
      `
      id,
      case_number,
      deleted_at,
      status:case_statuses(name_he, name_en, color),
      assigned_advisor:profiles!cases_assigned_advisor_id_fkey(first_name, last_name),
      case_borrowers(is_primary, borrower:borrowers(first_name, last_name))
    `,
    )
    .not('deleted_at', 'is', null)
    .gte('deleted_at', cutoffIso)
    .order('deleted_at', { ascending: false });

  const { data: casesData, error: casesErr } = await casesQuery;
  if (casesErr) {
    console.error('[listDeletedCases] cases query failed', { message: casesErr.message });
    return [];
  }
  const cases = (casesData ?? []) as unknown as RawCaseRow[];
  if (cases.length === 0) return [];

  const ids = cases.map((c) => c.id);
  const { data: auditData, error: auditErr } = await supabase
    .from('audit_log')
    .select(
      'record_id, user_id, timestamp, user:profiles!audit_log_user_id_fkey(first_name, last_name)',
    )
    .eq('table_name', 'cases')
    .eq('action', 'SOFT_DELETE')
    .in('record_id', ids)
    .order('timestamp', { ascending: false });
  if (auditErr) {
    console.error('[listDeletedCases] audit query failed', { message: auditErr.message });
  }
  const audits = (auditData ?? []) as unknown as AuditRow[];

  // Most recent SOFT_DELETE per case wins (a case can be deleted → restored
  // → deleted again — show the latest actor).
  const deletedBy = new Map<string, AuditRow['user']>();
  for (const row of audits) {
    if (!deletedBy.has(row.record_id)) deletedBy.set(row.record_id, row.user);
  }

  const now = Date.now();
  return cases.map((c) => {
    const primary = c.case_borrowers.find((b) => b.is_primary)?.borrower ?? null;
    const actor = deletedBy.get(c.id) ?? null;
    const deletedMs = new Date(c.deleted_at).getTime();
    const ageDays = Math.floor((now - deletedMs) / MS_PER_DAY);
    const remaining = Math.max(0, retentionDays - ageDays);
    return {
      id: c.id,
      caseNumber: c.case_number,
      statusNameHe: c.status?.name_he ?? null,
      statusNameEn: c.status?.name_en ?? null,
      statusColor: c.status?.color ?? null,
      primaryBorrowerFirstName: primary?.first_name ?? null,
      primaryBorrowerLastName: primary?.last_name ?? null,
      assignedAdvisorFirstName: c.assigned_advisor?.first_name ?? null,
      assignedAdvisorLastName: c.assigned_advisor?.last_name ?? null,
      deletedAt: c.deleted_at,
      deletedByFirstName: actor?.first_name ?? null,
      deletedByLastName: actor?.last_name ?? null,
      daysUntilPurge: remaining,
    };
  });
}
