/**
 * Internal helper — NOT a server action.
 *
 * Writes a system event row to `task_comments` from within an already-
 * authenticated server action. Called after the primary DB mutation succeeds;
 * failures are logged and swallowed so a telemetry write can never roll back
 * the main operation.
 *
 * @param supabase  An already-authenticated Supabase server client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

import type { TaskCommentInsert, TaskEventType } from '../types';

export async function emitTaskEvent(
  supabase: SupabaseClient<Database>,
  params: {
    taskId: string;
    authorId: string;
    eventType: TaskEventType;
    body: string;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  const row: TaskCommentInsert = {
    task_id: params.taskId,
    author_id: params.authorId,
    event_type: params.eventType,
    body: params.body,
    metadata: (params.metadata as Database['public']['Tables']['task_comments']['Insert']['metadata']) ?? null,
  };

  const { error } = await supabase.from('task_comments').insert(row);
  if (error) {
    console.error('[emitTaskEvent] insert failed', {
      eventType: params.eventType,
      taskId: params.taskId,
      code: error.code,
    });
  }
}
