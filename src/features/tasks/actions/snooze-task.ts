'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

import { emitTaskEvent } from '../lib/emit-task-event';
import type { TaskUpdate } from '../types';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'not_found' | 'validation' | 'unknown' };

const SNOOZE_MINUTES = { hour: 60, threeHours: 180, day: 1440 } as const;

const schema = z.object({
  taskId: z.uuid(),
  preset: z.enum(['hour', 'threeHours', 'day']),
});

/**
 * Manual "remind me again in X" snooze: parks the task in the `snoozed` status
 * with a `snoozed_until` time. The task-reminders cron resurfaces it (back to
 * pending + a bell notification) once that time passes.
 */
export async function snoozeTaskAction(taskId: string, preset: string): Promise<Result> {
  const parsed = schema.safeParse({ taskId, preset });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: existing } = await supabase
    .from('tasks')
    .select('id, case_id')
    .eq('id', parsed.data.taskId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return { ok: false, error: 'not_found' };

  const until = new Date(Date.now() + SNOOZE_MINUTES[parsed.data.preset] * 60_000).toISOString();
  const patch: TaskUpdate = {
    status: 'snoozed',
    snoozed_until: until,
    updated_by: userRes.user.id,
  };

  // .select() row-count guard: tasks_select is broader than tasks_update, so an
  // RLS-denied UPDATE affects 0 rows with no error — treat that as unauthorized.
  const { data: updated, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', parsed.data.taskId)
    .select('id');
  if (error) {
    console.error('[snoozeTask] db error', { code: error.code });
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  const presetLabel = { hour: 'שעה', threeHours: '3 שעות', day: 'יום' }[parsed.data.preset];
  await emitTaskEvent(supabase, {
    taskId: parsed.data.taskId,
    authorId: userRes.user.id,
    eventType: 'snoozed',
    body: `⏱ נדחתה ל${presetLabel}`,
    metadata: { snoozed_until: until },
  });

  revalidatePath('/tasks');
  if (existing.case_id) revalidatePath(`/cases/${existing.case_id}`);
  revalidatePath('/(app)', 'layout');
  return { ok: true };
}
