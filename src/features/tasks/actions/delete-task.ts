'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'validation' | 'unknown'; message?: string };

const taskIdSchema = z.uuid();

export async function deleteTaskAction(taskId: string): Promise<Result> {
  const idParsed = taskIdSchema.safeParse(taskId);
  if (!idParsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // Soft-delete only — retention purge runs on cleanup_soft_deleted_records.
  const { data: existing } = await supabase
    .from('tasks')
    .select('id, case_id')
    .eq('id', idParsed.data)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return { ok: false, error: 'not_found' };

  const { error } = await supabase
    .from('tasks')
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: userRes.user.id,
    })
    .eq('id', idParsed.data);

  if (error) return { ok: false, error: 'unknown', message: error.message };

  revalidatePath('/tasks');
  if (existing.case_id) revalidatePath(`/cases/${existing.case_id}`);
  return { ok: true };
}
