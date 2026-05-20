'use server';

import { revalidatePath } from 'next/cache';

import { sendTaskNotificationEmail } from '@/features/notifications/services/notification-email';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { TaskFormSchema } from '../schemas/task.schema';
import type { TaskActionState } from '../types';

export async function createTaskAction(
  _prevState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const values = formDataToValues(formData);

  const parsed = TaskFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized', values };
  const userId = userRes.user.id;

  // Defense-in-depth: if scoped to a case, verify visibility before insert.
  if (parsed.data.case_id) {
    const { data: caseRow } = await supabase
      .from('cases')
      .select('id')
      .eq('id', parsed.data.case_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!caseRow) return { ok: false, error: 'unauthorized', values };
  }

  const { data: inserted, error } = await supabase
    .from('tasks')
    .insert({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      priority: parsed.data.priority ?? 'normal',
      assigned_to: parsed.data.assigned_to ?? userId,
      case_id: parsed.data.case_id ?? null,
      due_date: parsed.data.due_date ?? null,
      created_by: userId,
      updated_by: userId,
    })
    .select('id')
    .single();

  if (error || !inserted) return { ok: false, error: 'unknown', values };

  const assignee = parsed.data.assigned_to ?? userId;
  if (assignee !== userId) {
    await sendTaskNotificationEmail({
      recipientId: assignee,
      actorId: userId,
      kind: 'task_assigned',
      taskTitle: parsed.data.title,
      caseId: parsed.data.case_id ?? null,
    });
  }

  revalidatePath('/tasks');
  if (parsed.data.case_id) revalidatePath(`/cases/${parsed.data.case_id}`);

  return { ok: true, taskId: inserted.id };
}
