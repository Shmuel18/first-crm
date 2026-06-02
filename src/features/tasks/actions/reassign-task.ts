'use server';

import { revalidatePath } from 'next/cache';

import { sendTaskNotificationEmail } from '@/features/notifications/services/notification-email';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

import { ReassignTaskSchema } from '../schemas/task.schema';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'validation' | 'unknown' };

type ReassignTaskRpcResult = {
  ok?: boolean;
  error?: 'unauthorized' | 'not_found' | 'validation' | 'unknown';
  task_id?: string;
  case_id?: string | null;
  title?: string;
  no_change?: boolean;
};

type ReassignTaskRpcClient = {
  rpc(
    fn: 'reassign_task',
    args: { p_task_id: string; p_assignee_id: string; p_note: string | null },
  ): Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
};

/**
 * Hand a task to another active teammate.
 *
 * The database RPC checks that the caller is the assignee, creator, an
 * all-cases user, or admin, then performs the update as SECURITY DEFINER. That
 * avoids the RLS trap where the NEW row is no longer assigned to the actor
 * after a handoff, which is exactly what happens when returning a task to its
 * creator.
 */
export async function reassignTaskAction(
  taskId: string,
  assigneeId: string,
  note?: string,
): Promise<Result> {
  const parsed = ReassignTaskSchema.safeParse({ taskId, assigneeId, note });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  const userId = userRes.user.id;

  const rpcClient = supabase as unknown as ReassignTaskRpcClient;
  const { data, error } = await rpcClient.rpc('reassign_task', {
    p_task_id: parsed.data.taskId,
    p_assignee_id: parsed.data.assigneeId,
    p_note: parsed.data.note?.trim() || null,
  });
  if (error) {
    console.error('[reassignTask] rpc error', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }

  const result = normalizeRpcResult(data);
  if (!result.ok) return { ok: false, error: result.error ?? 'unknown' };

  if (!result.no_change && result.title) {
    // Best-effort email mirror (never throws), matching create/update-task.
    await sendTaskNotificationEmail({
      recipientId: parsed.data.assigneeId,
      actorId: userId,
      kind: 'task_assigned',
      taskTitle: result.title,
      caseId: result.case_id ?? null,
    });
  }

  // Keep the action POST light; the recipient's realtime bell refreshes their
  // shell, while this revalidates the task page/case page for the actor.
  revalidatePath('/tasks');
  if (result.case_id) revalidatePath(`/cases/${result.case_id}`);
  return { ok: true };
}

function normalizeRpcResult(data: unknown): ReassignTaskRpcResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'unknown' };
  }

  const raw = data as Record<string, unknown>;
  const error =
    raw.error === 'unauthorized' ||
    raw.error === 'not_found' ||
    raw.error === 'validation' ||
    raw.error === 'unknown'
      ? raw.error
      : undefined;

  return {
    ok: raw.ok === true,
    error,
    task_id: typeof raw.task_id === 'string' ? raw.task_id : undefined,
    case_id: typeof raw.case_id === 'string' ? raw.case_id : null,
    title: typeof raw.title === 'string' ? raw.title : undefined,
    no_change: raw.no_change === true,
  };
}
