import { getTranslations } from 'next-intl/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/i18n/direction';
import type { CaseId } from '@/lib/types/branded';
import { formatPersonName } from '@/lib/utils/person-name';

import type { TaskListFilters } from '../schemas/task.schema';
import type {
  TaskAssignee,
  TaskCaseOption,
  TaskPriority,
  TaskStatus,
  TaskView,
  TaskWithRelations,
} from '../types';

// Explicit column list (audit-driven). Mirrors the tasks Row type so schema
// additions are gated by an intentional update here rather than auto-
// propagating to clients via `*`.
const TASK_FULL_COLUMNS =
  'id, title, description, status, priority, is_private, due_date, snoozed_until, completed_at, completed_by, case_id, lead_id, assigned_to, assigned_by, assigned_at, automation_rule_id, is_automated, google_calendar_event_id, metadata, deleted_at, created_at, created_by, updated_at, updated_by' as const;

const TASK_SELECT = `
  ${TASK_FULL_COLUMNS},
  case:cases!tasks_case_id_fkey(id, case_number, case_borrowers(is_primary, borrower:borrowers(first_name, last_name)))
` as const;

const CASE_OPTION_SELECT = `
  id,
  case_number,
  case_borrowers(is_primary, borrower:borrowers(first_name, last_name))
` as const;

// Status sort weight — 'status' is a TEXT column, so DB ascending order is
// alphabetical (cancelled<completed<pending<snoozed). Sort in JS instead so
// active tasks surface first.
const STATUS_ORDER: Record<TaskStatus, number> = {
  pending: 0,
  in_progress: 1,
  snoozed: 2,
  completed: 3,
  cancelled: 4,
};

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function assignedByMeFilter(userId: string): string {
  return `assigned_by.eq.${userId},and(assigned_to.is.null,created_by.eq.${userId})`;
}

export async function listTasks(filters: TaskListFilters): Promise<TaskWithRelations[]> {
  const supabase = await createClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return [];
  const userId = userRes.user.id;

  let query = supabase
    .from('tasks')
    .select(TASK_SELECT)
    .is('deleted_at', null);

  if (filters.view === 'mine') {
    query = query.eq('assigned_to', userId);
  } else if (filters.view === 'assigned-by-me') {
    // Keep creator-owned unassigned tasks visible here too. Without this
    // fallback, clearing an assignment makes the task disappear from both
    // "mine" and "assigned by me".
    query = query.or(assignedByMeFilter(userId));
  }
  // 'all' = no extra filter; RLS will narrow to what the user is allowed to see.

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.caseId) query = query.eq('case_id', filters.caseId);
  if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);

  // DB orders the secondary keys; status priority is applied in JS below
  // (stable sort preserves these within each status group).
  query = query
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  // PostgREST can't infer the embedded-relation shape; the select string above
  // is the contract, and DB CHECKs guarantee the narrowed priority/status.
  const rows = (data ?? []) as unknown as Array<
    Omit<TaskWithRelations, 'case' | 'assignee' | 'creator' | 'assigner'> & {
      case: { id: string; case_number: string; case_borrowers?: CaseBorrowerLink[] | null } | null;
    }
  >;
  const peopleById = await resolveTaskPeople(rows);

  // Resolve each task's case ref to show the client's name (not the raw number).
  return rows
    .map((row) => ({
      ...row,
      assignee: personFor(row.assigned_to, peopleById),
      creator: personFor(row.created_by, peopleById),
      assigner: personFor(row.assigned_by, peopleById),
      case: toCaseRef(row.case),
    }))
    .sort(
      (a, b) =>
        (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
        (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
    );
}

async function resolveTaskPeople(
  rows: ReadonlyArray<{ assigned_to: string | null; created_by: string | null; assigned_by: string | null }>,
): Promise<Map<string, TaskAssignee>> {
  const ids = [
    ...new Set(
      rows.flatMap((row) => [row.assigned_to, row.created_by, row.assigned_by]).filter(isString),
    ),
  ];
  if (ids.length === 0) return new Map();

  // Profile RLS is self-or-admin, but every task viewer needs the display names
  // attached to assignment context. Resolve names only through the admin client.
  const admin = createAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', ids);

  return new Map((data ?? []).map((person) => [person.id, person]));
}

function personFor(id: string | null, peopleById: ReadonlyMap<string, TaskAssignee>): TaskAssignee | null {
  return id ? peopleById.get(id) ?? null : null;
}

function isString(value: string | null): value is string {
  return typeof value === 'string';
}

function toCaseRef(
  c: { id: string; case_number: string; case_borrowers?: CaseBorrowerLink[] | null } | null,
): TaskWithRelations['case'] {
  if (!c) return null;
  const borrower = primaryBorrower(c.case_borrowers ?? null);
  const name = formatPersonName(borrower?.first_name, borrower?.last_name);
  return { id: c.id, case_number: c.case_number, clientName: name || null };
}

export async function listTasksForCase(caseId: CaseId): Promise<TaskWithRelations[]> {
  const tasks = await listTasks({ view: 'all', caseId });
  return tasks.filter((task) => task.status !== 'completed' && task.status !== 'cancelled');
}

export async function countPendingTasksForUser(): Promise<number> {
  return countPendingByView('mine');
}

export async function countPendingByView(view: TaskView): Promise<number> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return 0;

  let query = supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .is('deleted_at', null);

  if (view === 'mine') query = query.eq('assigned_to', userRes.user.id);
  else if (view === 'assigned-by-me') query = query.or(assignedByMeFilter(userRes.user.id));

  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

export async function listAssignableProfiles(): Promise<TaskAssignee[]> {
  // AUDIT-ACK: admin (service-role) client by design. profiles RLS is
  // self-or-admin (mig 011), so the cookie-bound client returns only the
  // caller's own row for a non-admin — the task-assignee picker (create +
  // reassign) then offered an advisor ONLY themselves. Return the active team
  // (id + names only — no sensitive columns) so anyone who works tasks can
  // assign to a colleague. Matches "anyone with case access can assign to
  // anyone with case access" for this small office.
  // NOTE: not yet scoped to a specific case's accessors — a per-case,
  // permission-aware RPC is the refinement if cross-case mis-assignment ever
  // becomes a problem.
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('is_active', true)
    .order('first_name');
  return data ?? [];
}

export async function listCaseOptions(locale: Locale): Promise<TaskCaseOption[]> {
  const supabase = await createClient();
  const noName = await resolveNoName(locale);
  // Non-inner join so cases without a primary borrower (e.g. brand-new cases)
  // still appear in the picker.
  const { data } = await supabase
    .from('cases')
    .select(CASE_OPTION_SELECT)
    .is('deleted_at', null)
    .order('is_archived', { ascending: true })
    .order('case_number', { ascending: false })
    .limit(1000);

  return (data ?? []).map((row) => ({
    id: row.id,
    case_number: row.case_number,
    label: caseOptionLabel(row.case_number, primaryBorrower(row.case_borrowers), noName),
  }));
}

export async function getCaseOption(
  caseId: CaseId,
  locale: Locale,
): Promise<TaskCaseOption | null> {
  const supabase = await createClient();
  const noName = await resolveNoName(locale);
  const { data } = await supabase
    .from('cases')
    .select(CASE_OPTION_SELECT)
    .eq('id', caseId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    case_number: data.case_number,
    label: caseOptionLabel(data.case_number, primaryBorrower(data.case_borrowers), noName),
  };
}

async function resolveNoName(locale: Locale): Promise<string> {
  const tc = await getTranslations({ locale, namespace: 'common' });
  return tc('noName');
}

export async function getCaseNumberLabel(caseId: CaseId): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('cases')
    .select(CASE_OPTION_SELECT)
    .eq('id', caseId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return null;
  // Prefer the primary borrower's name in the chip — the case number is
  // less recognisable than the client's name when scanning. Fall back to
  // `#{case_number}` if the case has no primary borrower yet (brand-new
  // or after the primary was removed).
  const borrower = primaryBorrower(data.case_borrowers);
  const name = formatPersonName(borrower?.first_name, borrower?.last_name);
  return name || `#${data.case_number}`;
}

type BorrowerName = { first_name: string | null; last_name: string | null };
type CaseBorrowerLink = { is_primary: boolean; borrower: BorrowerName | null };

function primaryBorrower(links: CaseBorrowerLink[] | null): BorrowerName | null {
  // Prefer the flagged primary, but fall back to the first linked borrower —
  // some cases have no is_primary set on case_borrowers, and the dashboard
  // label (getCaseClientLabel) does the same fallback. Without it those cases
  // render as "(no name)" here and break the task case-picker search by name.
  const withBorrower = (links ?? []).filter((cb) => cb.borrower !== null);
  return (withBorrower.find((cb) => cb.is_primary) ?? withBorrower[0])?.borrower ?? null;
}

function caseOptionLabel(
  caseNumber: string,
  borrower: BorrowerName | null,
  noName: string,
): string {
  const name = formatPersonName(borrower?.first_name, borrower?.last_name) || noName;
  return `#${caseNumber} · ${name}`;
}
