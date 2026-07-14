'use server';

import { after } from 'next/server';

import { getDriveClientIfConnected } from '@/features/integrations/services/drive-case-uploader';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import {
  TASK_DOCUMENTS_BUCKET,
  listTaskAttachments,
  type TaskAttachment,
} from '../services/task-attachments.service';

/** List a task's general attachments (RLS scopes to visible tasks). */
export async function listTaskAttachmentsAction(taskId: string): Promise<TaskAttachment[]> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return [];
  try {
    return await listTaskAttachments(taskId);
  } catch (err) {
    console.error('[listTaskAttachments] failed', err instanceof Error ? err.message : 'unknown');
    return [];
  }
}

export type TaskCaseDocument = {
  id: string;
  file_name: string;
  mime_type: string | null;
  drive_file_url: string | null;
};

/**
 * Files attached to a case-LINKED task land in the case's documents (not the
 * task_attachments store), tagged metadata.task_id. They never showed in the
 * task — confusing ("I uploaded a doc but can't see it"). List them so the task
 * dialog can surface them. RLS (documents_select → can_view_case) scopes the
 * read; mig 182 means the assignee can see the linked case's documents.
 */
export async function listTaskCaseDocumentsAction(taskId: string): Promise<TaskCaseDocument[]> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return [];
  const { data, error } = await supabase
    .from('documents')
    .select('id, file_name, mime_type, drive_file_url')
    .eq('metadata->>task_id', taskId)
    .eq('metadata->>source', 'task_attachment')
    .is('deleted_at', null)
    .order('upload_date', { ascending: false });
  if (error) {
    console.error('[listTaskCaseDocuments] failed', error.message);
    return [];
  }
  return data ?? [];
}

export type TaskAttachmentUrlResult = { ok: true; url: string } | { ok: false };

const INLINE_AUDIO_URL_TTL_SECONDS = 10 * 60;

/** Short-lived signed URL to download one attachment. RLS gates the row read. */
export async function getTaskAttachmentUrlAction(
  attachmentId: string,
): Promise<TaskAttachmentUrlResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false };

  const { data: row, error } = await supabase
    .from('task_attachments')
    .select('storage_path')
    .eq('id', attachmentId)
    .maybeSingle();
  if (error || !row) return { ok: false };

  const { data: signed, error: signErr } = await supabase.storage
    .from(TASK_DOCUMENTS_BUCKET)
    .createSignedUrl(row.storage_path, INLINE_AUDIO_URL_TTL_SECONDS);
  if (signErr || !signed?.signedUrl) return { ok: false };
  return { ok: true, url: signed.signedUrl };
}

export type DeleteTaskAttachmentResult = { ok: true } | { ok: false };

/** Delete an attachment (RLS: uploader or admin) + its blob and Drive copy. */
export async function deleteTaskAttachmentAction(
  attachmentId: string,
): Promise<DeleteTaskAttachmentResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false };

  const { data: row } = await supabase
    .from('task_attachments')
    .select('storage_path, drive_file_id')
    .eq('id', attachmentId)
    .maybeSingle();
  if (!row) return { ok: false };

  // RLS (uploader/admin) decides the delete; 0 rows back means not allowed.
  const { data: deleted, error: delErr } = await supabase
    .from('task_attachments')
    .delete()
    .eq('id', attachmentId)
    .select('id');
  if (delErr || !deleted || deleted.length === 0) return { ok: false };

  // Best-effort cleanup AFTER the response — never block the trash button. The row is
  // already deleted (the user's action, and TaskAttachmentsList drops it from its own
  // state on success), so the Storage remove + a Drive deleteFile (token refresh +
  // DELETE round-trip when connected) must not be awaited before returning. Admin
  // client for the Storage remove: after() runs outside the request, so there's no
  // user session for the user-client to authenticate with.
  const storagePath = row.storage_path;
  const driveFileId = row.drive_file_id;
  after(async () => {
    const admin = createAdminClient();
    await admin.storage.from(TASK_DOCUMENTS_BUCKET).remove([storagePath]).catch(() => undefined);
    if (driveFileId) {
      const client = await getDriveClientIfConnected();
      if (client) await client.deleteFile(driveFileId).catch(() => undefined);
    }
  });

  // No revalidatePath('/tasks'): TaskAttachmentsList drops the deleted row from its
  // own list, so re-rendering the tasks page into this POST would only add latency.
  return { ok: true };
}
