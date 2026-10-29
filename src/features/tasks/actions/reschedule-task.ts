'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { israelWallClockNow, israelWallClockToIso } from '@/lib/utils/israel-time';

type Result = { ok: true } | { ok: false; error: 'validation' | 'unauthorized' | 'unknown' };

const RescheduleSchema = z.object({ taskId: z.uuid(), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/**
 * Move a task's due date to another day (the calendar's drag), keeping its
 * Israel time of day. RLS decides who may update the task.
 */
export async function rescheduleTaskAction(taskId: string, day: string): Promise<Result> {
  const parsed = RescheduleSchema.safeParse({ taskId, day });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: task } = await supabase
    .from('tasks')
    .select('id, due_date')
    .eq('id', parsed.data.taskId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!task) return { ok: false, error: 'unauthorized' };

  const time = task.due_date ? israelWallClockNow(new Date(task.due_date)).slice(11, 16) : '09:00';
  const due = israelWallClockToIso(`${parsed.data.day}T${time}`);
  if (!due) return { ok: false, error: 'validation' };

  const { data, error } = await supabase
    .from('tasks')
    .update({ due_date: due, updated_by: userRes.user.id })
    .eq('id', task.id)
    .select('id');
  if (error) {
    console.error('[rescheduleTask] failed', error.code);
    return { ok: false, error: 'unknown' };
  }
  if (!data || data.length === 0) return { ok: false, error: 'unauthorized' };
  revalidatePath('/calendar');
  revalidatePath('/tasks');
  return { ok: true };
}
