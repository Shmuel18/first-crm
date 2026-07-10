'use server';

import { after } from 'next/server';
import { z } from 'zod';

import { sendTaskNotificationEmail } from '@/features/notifications/services/notification-email';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

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
    .select('id, case_id, assigned_to, created_by')
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

  // A private task is a reminder to its creator — force assignment to the
  // creator so it satisfies the self-assigned CHECK and stays private.
  const isPrivate = parsed.data.is_private;
  const assignee = isPrivate ? existing.created_by : parsed.data.assigned_to ?? null;
  // `is_private` (mig 098) isn't typed yet; cast bypasses the excess-key check.
  const patch = {
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    priority: parsed.data.priority ?? 'normal',
    assigned_to: assignee,
    case_id: parsed.data.case_id ?? null,
    due_date: parsed.data.due_date ?? null,
    is_private: isPrivate,
    updated_by: userRes.user.id,
  } as TaskUpdate;

  const { data: updated, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', taskId)
    .select('id');

  if (error) return { ok: false, error: 'unknown', values };
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized', values };

  if (assignee && assignee !== existing.assigned_to && assignee !== userRes.user.id) {
    // Best-effort email mirror, sent AFTER the response so the button releases
    // immediately (Resend HTTP + DB hops). Bell is DB-trigger-driven.
    after(() =>
      sendTaskNotificationEmail({
        recipientId: assignee,
        actorId: userRes.user.id,
        kind: 'task_assigned',
        taskTitle: parsed.data.title,
        caseId: parsed.data.case_id ?? existing.case_id,
      }),
    );
  }

  // No revalidatePath (same reason as create-task): revalidating the heavy
  // /cases/[id] re-rendered it into this POST response and spun the button
  // 0.5-2s. The shared TaskFormDialog calls router.refresh() on success to
  // update the list in the background; the bell covers the recipient's view.
  return { ok: true, taskId };
}
