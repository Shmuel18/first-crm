import { createAdminClient } from '@/lib/supabase/admin';
import type { Database, Json } from '@/types/database';

type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];

export type TaskReminderResult = {
  /** Snoozed tasks whose snooze time had passed. */
  due: number;
  /** Bell notifications created (one per due task that has an owner). */
  notified: number;
};

/**
 * Resurfaces snoozed tasks whose `snoozed_until` has passed: flips them back to
 * `pending`, clears the snooze time, and fans out a `task_reminder` bell
 * notification to each task's owner (assignee, else creator). Uses the admin
 * client to bypass RLS (system-generated rows + cross-user resurface).
 *
 * Each resurface is one-shot — clearing snoozed_until + flipping the status
 * means a task can't be re-found on the next run, so no dedupe table is needed.
 */
export async function runTaskReminders(): Promise<TaskReminderResult> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: dueTasks, error } = await supabase
    .from('tasks')
    .select('id, title, assigned_to, created_by, case_id')
    .eq('status', 'snoozed')
    .not('snoozed_until', 'is', null)
    .lte('snoozed_until', nowIso)
    .is('deleted_at', null);
  if (error) throw new Error(`tasks (snoozed) read failed: ${error.message}`);
  if (!dueTasks || dueTasks.length === 0) return { due: 0, notified: 0 };

  const ids = dueTasks.map((task) => task.id);
  const { error: resurfaceErr } = await supabase
    .from('tasks')
    .update({ status: 'pending', snoozed_until: null })
    .in('id', ids);
  if (resurfaceErr) throw new Error(`tasks resurface failed: ${resurfaceErr.message}`);

  const inserts: NotificationInsert[] = [];
  for (const task of dueTasks) {
    const recipient = task.assigned_to ?? task.created_by;
    if (!recipient) continue;
    inserts.push({
      user_id: recipient,
      type: 'task_reminder',
      task_id: task.id,
      case_id: task.case_id,
      data: { taskTitle: task.title, actorName: null } as Json,
    });
  }

  if (inserts.length > 0) {
    const { error: insertErr } = await supabase.from('notifications').insert(inserts);
    if (insertErr) throw new Error(`task_reminder insert failed: ${insertErr.message}`);
  }

  return { due: dueTasks.length, notified: inserts.length };
}
