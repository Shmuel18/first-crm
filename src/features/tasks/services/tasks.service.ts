import { createClient } from '@/lib/supabase/server';
import type { CaseId, TaskId } from '@/lib/types/branded';

import type { TaskListFilters } from '../schemas/task.schema';
import type { TaskWithRelations } from '../types';

const TASK_SELECT = `
  *,
  assignee:profiles!tasks_assigned_to_fkey(id, first_name, last_name),
  creator:profiles!tasks_created_by_fkey(id, first_name, last_name),
  case:cases!tasks_case_id_fkey(id, case_number)
` as const;

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

  // Show pending first, then by due_date ascending (NULLs last), then created_at desc.
  query = query
    .order('status', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as TaskWithRelations[];
}

export async function listTasksForCase(caseId: CaseId): Promise<TaskWithRelations[]> {
  return listTasks({ view: 'all', caseId });
}

export async function getTaskById(id: TaskId): Promise<TaskWithRelations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as TaskWithRelations | null;
}

export async function countPendingTasksForUser(): Promise<number> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return 0;

  const { count, error } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_to', userRes.user.id)
    .eq('status', 'pending')
    .is('deleted_at', null);

  if (error) return 0;
  return count ?? 0;
}
