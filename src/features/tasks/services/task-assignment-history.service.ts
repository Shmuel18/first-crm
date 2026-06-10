'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import type { TaskAssignee, TaskAssignmentHistoryEntry } from '../types';

const HISTORY_COLUMNS =
  'id, task_id, assigned_from, assigned_to, assigned_by, assigned_at' as const;

type Result =
  | { ok: true; history: TaskAssignmentHistoryEntry[] }
  | { ok: false; error: 'unauthorized' | 'unknown' };

export async function getTaskAssignmentHistoryAction(taskId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data, error } = await supabase
    .from('task_assignment_history')
    .select(HISTORY_COLUMNS)
    .eq('task_id', taskId)
    .order('assigned_at', { ascending: false });

  if (error) {
    console.error('[getTaskAssignmentHistory] db error', error.code);
    return { ok: false, error: 'unknown' };
  }

  const rows = data ?? [];
  const ids = [
    ...new Set(
      rows
        .flatMap((row) => [row.assigned_from, row.assigned_to, row.assigned_by])
        .filter(isString),
    ),
  ];
  const peopleById = new Map<string, TaskAssignee>();

  if (ids.length > 0) {
    const admin = createAdminClient();
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', ids);
    for (const profile of profiles ?? []) peopleById.set(profile.id, profile);
  }

  return {
    ok: true,
    history: rows.map((row) => ({
      id: row.id,
      assignedAt: row.assigned_at,
      from: personFor(row.assigned_from, peopleById),
      to: personFor(row.assigned_to, peopleById),
      by: personFor(row.assigned_by, peopleById),
    })),
  };
}

function personFor(id: string | null, peopleById: ReadonlyMap<string, TaskAssignee>): TaskAssignee | null {
  return id ? peopleById.get(id) ?? null : null;
}

function isString(value: string | null): value is string {
  return typeof value === 'string';
}
