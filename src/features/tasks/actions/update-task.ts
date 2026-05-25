'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { sendTaskNotificationEmail } from '@/features/notifications/services/notification-email';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { parseTaskTags } from '../domain/task-tags';
import { TaskFormSchema } from '../schemas/task.schema';
import type { TaskActionState, TaskUpdate } from '../types';

const taskIdSchema = z.uuid({ error: 'common.errors.invalidUuid' });

export async function updateTaskAction(
  _prevState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const values = formDataToValues(formData);

  const taskIdParsed = taskIdSchema.safeParse(formData.get('task_id'));
  if (!taskIdParsed.success) return { ok: false, error: 'validation', values };
  const taskId = taskIdParsed.data;

  const parsed = TaskFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized', values };

  // Surface "not_found" cleanly before mutating; RLS would also catch this.
  const { data: existing } = await supabase
    .from('tasks')
    .select('id, case_id, assigned_to')
    .eq('id', taskId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return { ok: false, error: 'not_found', values };

  // Reassign to a different case → confirm visibility.
  if (parsed.data.case_id && parsed.data.case_id !== existing.case_id) {
    const { data: caseRow } = await supabase
      .from('cases')
      .select('id')
      .eq('id', parsed.data.case_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!caseRow) return { ok: false, error: 'unauthorized', values };
  }

  // `tags` (mig 034) isn't typed yet; cast bypasses the excess-key check.
  const patch = {
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    priority: parsed.data.priority ?? 'normal',
    assigned_to: parsed.data.assigned_to ?? null,
    case_id: parsed.data.case_id ?? null,
    due_date: parsed.data.due_date ?? null,
    tags: parseTaskTags(formData.getAll('tags').map(String)),
    updated_by: userRes.user.id,
  } as TaskUpdate;

  const { data: updated, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', taskId)
    .select('id');

  if (error) return { ok: false, error: 'unknown', values };
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized', values };

  const newAssignee = parsed.data.assigned_to ?? null;
  if (newAssignee && newAssignee !== existing.assigned_to && newAssignee !== userRes.user.id) {
    await sendTaskNotificationEmail({
      recipientId: newAssignee,
      actorId: userRes.user.id,
      kind: 'task_assigned',
      taskTitle: parsed.data.title,
      caseId: parsed.data.case_id ?? existing.case_id,
    });
  }

  revalidatePath('/tasks');
  const newCaseId = parsed.data.case_id ?? null;
  if (newCaseId) revalidatePath(`/cases/${newCaseId}`);
  // On a case move, refresh the old case too so the task stops showing there.
  if (existing.case_id && existing.case_id !== newCaseId) {
    revalidatePath(`/cases/${existing.case_id}`);
  }

  return { ok: true, taskId };
}
