'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'validation' | 'unknown' };

const taskIdSchema = z.uuid();

/**
 * Flip a completed task back to pending — clears completed_at / completed_by
 * so the task re-enters the "open" buckets. No notification email here on
 * purpose: re-opening is usually a self-correction by the same user who just
 * completed it, and pinging the original creator on every misclick would be
 * noise.
 */
export async function reopenTaskAction(taskId: string): Promise<Result> {
  const idParsed = taskIdSchema.safeParse(taskId);
  if (!idParsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: existing } = await supabase
    .from('tasks')
    .select('id, case_id')
    .eq('id', idParsed.data)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return { ok: false, error: 'not_found' };

  const { data: updated, error } = await supabase
    .from('tasks')
    .update({
      status: 'pending',
      completed_at: null,
      completed_by: null,
      updated_by: userRes.user.id,
    })
    .eq('id', idParsed.data)
    .select('id');

  if (error) {
    console.error('[reopenTask] db error', error);
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  revalidatePath('/tasks');
  if (existing.case_id) revalidatePath(`/cases/${existing.case_id}`);
  revalidatePath('/(app)', 'layout');
  return { ok: true };
}
