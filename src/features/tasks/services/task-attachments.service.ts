import { createClient } from '@/lib/supabase/server';

/** Dedicated Storage bucket for case-less task files (migration 157). */
export const TASK_DOCUMENTS_BUCKET = 'task-documents';

const TASK_ATTACHMENT_COLUMNS =
  'id, task_id, file_name, file_size, mime_type, storage_path, drive_file_url, uploaded_by, created_at' as const;

export type TaskAttachment = {
  id: string;
  task_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  drive_file_url: string | null;
  uploaded_by: string | null;
  created_at: string;
};

/** Storage path convention: `<task_id>/<attachment_id>.<ext>` (RLS keys on segment 1). */
export function taskAttachmentPath(taskId: string, attachmentId: string, fileName: string): string {
  const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
  const safeExt = ext ? `.${ext.toLowerCase()}` : '';
  return `${taskId}/${attachmentId}${safeExt}`;
}

/** Attachments for a task. RLS (can_view_task) scopes to tasks the caller can see. */
export async function listTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('task_attachments')
    .select(TASK_ATTACHMENT_COLUMNS)
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
