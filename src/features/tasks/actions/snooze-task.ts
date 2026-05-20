'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'validation' | 'unknown'; message?: string };

const snoozeSchema = z.object({
  taskId: z.uuid(),
  snoozedUntil: z.iso.date(),
});

export async function snoozeTaskAction(
  taskId: string,
  snoozedUntilIso: string,
): Promise<Result> {
  const parsed = snoozeSchema.safeParse({ taskId, snoozedUntil: snoozedUntilIso });
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

  // tasks_select is broader than tasks_update, so an RLS-denied UPDATE affects
  // 0 rows with no error — confirm via .select() instead of false success.
  const { data: updated, error } = await supabase
    .from('tasks')
    .update({
      status: 'snoozed',
      snoozed_until: parsed.data.snoozedUntil,
      updated_by: userRes.user.id,
    })
    .eq('id', parsed.data.taskId)
    .select('id');

  if (error) return { ok: false, error: 'unknown', message: error.message };
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  revalidatePath('/tasks');
  if (existing.case_id) revalidatePath(`/cases/${existing.case_id}`);
  return { ok: true };
}
