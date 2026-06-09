'use server';

import { revalidatePath } from 'next/cache';

import { getDriveClientIfConnected } from '@/features/integrations/services/drive-case-uploader';
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

export type TaskAttachmentUrlResult = { ok: true; url: string } | { ok: false };

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
    .createSignedUrl(row.storage_path, 60);
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

  // Best-effort cleanup — never fail the delete on these.
  await supabase.storage.from(TASK_DOCUMENTS_BUCKET).remove([row.storage_path]).catch(() => undefined);
  if (row.drive_file_id) {
    const client = await getDriveClientIfConnected();
    if (client) await client.deleteFile(row.drive_file_id).catch(() => undefined);
  }

  revalidatePath('/tasks');
  return { ok: true };
}
