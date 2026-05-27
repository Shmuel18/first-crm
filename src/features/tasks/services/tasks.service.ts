import { getTranslations } from 'next-intl/server';

import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/i18n/direction';
import type { CaseId } from '@/lib/types/branded';

import type { TaskListFilters } from '../schemas/task.schema';
import type { TaskAssignee, TaskCaseOption, TaskStatus, TaskView, TaskWithRelations } from '../types';

// Explicit column list (audit-driven). Mirrors the tasks Row type so schema
// additions are gated by an intentional update here rather than auto-
// propagating to clients via `*`.
const TASK_FULL_COLUMNS =
  'id, title, description, status, priority, tags, due_date, snoozed_until, completed_at, completed_by, case_id, lead_id, assigned_to, automation_rule_id, is_automated, google_calendar_event_id, metadata, deleted_at, created_at, created_by, updated_at, updated_by' as const;

const TASK_SELECT = `
  ${TASK_FULL_COLUMNS},
  assignee:profiles!tasks_assigned_to_fkey(id, first_name, last_name),
  creator:profiles!tasks_created_by_fkey(id, first_name, last_name),
  case:cases!tasks_case_id_fkey(id, case_number)
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
    query = query.eq('created_by', userId);
  }
  // 'all' = no extra filter; RLS will narrow to what the user is allowed to see.

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.caseId) query = query.eq('case_id', filters.caseId);

  // DB orders the secondary keys; status priority is applied in JS below
  // (stable sort preserves these within each status group).
  query = query
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  // PostgREST can't infer the embedded-relation shape; the select string above
  // is the contract, and DB CHECKs guarantee the narrowed priority/status.
  const rows = (data ?? []) as unknown as TaskWithRelations[];
  return rows.sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9),
  );
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
  else if (view === 'assigned-by-me') query = query.eq('created_by', userRes.user.id);

  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

export async function listAssignableProfiles(): Promise<TaskAssignee[]> {
  const supabase = await createClient();
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
    .order('case_number', { ascending: false })
    .limit(200);

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
  const name = [borrower?.first_name, borrower?.last_name].filter(Boolean).join(' ');
  return name || `#${data.case_number}`;
}

type BorrowerName = { first_name: string | null; last_name: string | null };
type CaseBorrowerLink = { is_primary: boolean; borrower: BorrowerName | null };

function primaryBorrower(links: CaseBorrowerLink[] | null): BorrowerName | null {
  return links?.find((cb) => cb.is_primary)?.borrower ?? null;
}

function caseOptionLabel(
  caseNumber: string,
  borrower: BorrowerName | null,
  noName: string,
): string {
  const name = [borrower?.first_name, borrower?.last_name].filter(Boolean).join(' ') || noName;
  return `#${caseNumber} · ${name}`;
}
