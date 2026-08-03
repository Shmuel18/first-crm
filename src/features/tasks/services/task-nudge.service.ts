import { createClient } from '@/lib/supabase/server';

import { countTasksAwaitingUpdate } from '../domain/task-nudge';

export type TaskNudgeData = { firstName: string | null; staleCount: number };

/**
 * Data for the "update your tasks" nudge dialog: how many of the CURRENT
 * user's pending tasks are overdue / stale, plus their first name for the
 * personalized headline. Returns null when there is nothing to nag about —
 * and on any error (the nudge is best-effort; it must never break the shell).
 */
export async function getTaskNudgeData(): Promise<TaskNudgeData | null> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('status, due_date, updated_at')
    .eq('assigned_to', userRes.user.id)
    .eq('status', 'pending')
    .is('deleted_at', null);
  if (error || !tasks) {
    if (error) console.error('[taskNudge] tasks read failed', { code: error.code });
    return null;
  }

  const staleCount = countTasksAwaitingUpdate(tasks);
  if (staleCount === 0) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name')
    .eq('id', userRes.user.id)
    .maybeSingle();

  return { firstName: profile?.first_name ?? null, staleCount };
}
