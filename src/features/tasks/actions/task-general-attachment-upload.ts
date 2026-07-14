'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { fileTypeFromBuffer } from 'file-type';

import { sanitizeFilename } from '@/features/documents/domain/sanitize-filename';
import { MAX_FILE_SIZE_BYTES } from '@/features/documents/schemas/document.schema';
import { uploadGeneralDocumentToDrive } from '@/features/integrations/services/drive-general-uploader';
import { userHasPermission } from '@/lib/auth/permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

import { isAcceptedDeclaredMime, resolveStoredMime } from '../domain/recording';
import { TASK_DOCUMENTS_BUCKET, taskAttachmentPath } from '../services/task-attachments.service';

const MAGIC_SNIFF_BYTES = 4096;

type AttachmentError = 'unauthorized' | 'validation' | 'storage' | 'rate_limited' | 'unknown';

export type PrepareGeneralTaskAttachmentResult =
  | { ok: true; attachmentId: string; path: string; signedUrl: string; safeFileName: string }
  | { ok: false; error: AttachmentError; message?: string };

export type FinalizeGeneralTaskAttachmentResult =
  | { ok: true; attachmentId: string }
  | { ok: false; error: AttachmentError; message?: string };

/** A task is "visible" if the user's RLS lets them SELECT it. */
async function taskVisible(taskId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from('tasks').select('id').eq('id', taskId).maybeSingle();
  return Boolean(data);
}

async function cleanupBlob(path: string): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from(TASK_DOCUMENTS_BUCKET).remove([path]).catch(() => undefined);
}

export async function prepareGeneralTaskAttachmentAction(input: {
  taskId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}): Promise<PrepareGeneralTaskAttachmentResult> {
  if (input.fileSize <= 0) return { ok: false, error: 'validation', message: 'fileRequired' };
  if (input.fileSize > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: 'validation', message: 'fileTooLarge' };
  }
  if (!isAcceptedDeclaredMime(input.mimeType)) {
    return { ok: false, error: 'validation', message: 'fileTypeNotAllowed' };
  }
  const safeFileName = sanitizeFilename(input.fileName);
  if (!safeFileName) return { ok: false, error: 'validation', message: 'fileRequired' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('upload_document')) || !(await taskVisible(input.taskId))) {
    return { ok: false, error: 'unauthorized' };
  }

  // Throttle the upload prepare (gates the expensive finalize) per user (TASK-ATT-6).
  const allowed = await checkRateLimit({
    action: 'prepare_general_task_attachment',
    subject: `user:${userRes.user.id}`,
    max: 120,
    windowSeconds: 60,
    failMode: 'closed',
  });
  if (!allowed) return { ok: false, error: 'rate_limited' };

  const attachmentId = randomUUID();
  const path = taskAttachmentPath(input.taskId, attachmentId, safeFileName);
  const { data, error } = await supabase.storage
    .from(TASK_DOCUMENTS_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[prepareGeneralTaskAttachment] signed url failed', safeDbError(error));
    return { ok: false, error: 'storage' };
  }
  return { ok: true, attachmentId, path, signedUrl: data.signedUrl, safeFileName };
}

export async function finalizeGeneralTaskAttachmentAction(input: {
  taskId: string;
  attachmentId: string;
  fileName: string;
  fileSize: number;
  // Declared mime — advisory (the sniff below stays authoritative). Only used to
  // tell an audio recording (which sniffs as a video/* container) from a document.
  mimeType: string;
}): Promise<FinalizeGeneralTaskAttachmentResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // Recompute the storage path server-side from taskId + attachmentId +
  // sanitized filename — never trust the client path (cross-task binding;
  // R13 TASK-ATT-2).
  const safeFileName = sanitizeFilename(input.fileName);
  if (!safeFileName) {
    return { ok: false, error: 'validation', message: 'fileRequired' };
  }
  const storagePath = taskAttachmentPath(input.taskId, input.attachmentId, safeFileName);

  if (!(await userHasPermission('upload_document')) || !(await taskVisible(input.taskId))) {
    await cleanupBlob(storagePath);
    return { ok: false, error: 'unauthorized' };
  }

  // Sniff the magic bytes — never trust the client-declared mime type.
  const { data: signed, error: signErr } = await supabase.storage
    .from(TASK_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, 60);
  if (signErr || !signed?.signedUrl) {
    await cleanupBlob(storagePath);
    return { ok: false, error: 'storage' };
  }
  const sniffRes = await fetch(signed.signedUrl, {
    headers: { Range: `bytes=0-${MAGIC_SNIFF_BYTES - 1}` },
  });
  if (!sniffRes.ok) {
    await cleanupBlob(storagePath);
    return { ok: false, error: 'storage' };
  }
  const sniffed = await fileTypeFromBuffer(Buffer.from(await sniffRes.arrayBuffer()));
  const storedMime = sniffed ? resolveStoredMime(input.mimeType, sniffed.mime) : null;
  if (!storedMime) {
    await cleanupBlob(storagePath);
    return { ok: false, error: 'validation', message: 'fileTypeNotAllowed' };
  }

  // Best-effort Drive copy to the standalone general folder.
  let driveFileId: string | null = null;
  let driveFileUrl: string | null = null;
  const { data: blob } = await supabase.storage
    .from(TASK_DOCUMENTS_BUCKET)
    .download(storagePath);
  if (blob) {
    const out = await uploadGeneralDocumentToDrive({
      file: { content: await blob.arrayBuffer(), name: safeFileName, mimeType: storedMime },
    });
    if (out.ok) {
      driveFileId = out.driveFileId;
      driveFileUrl = out.webViewLink;
    }
  }

  const { error: insertErr } = await supabase.from('task_attachments').insert({
    id: input.attachmentId,
    task_id: input.taskId,
    file_name: safeFileName,
    file_size: input.fileSize,
    mime_type: storedMime,
    storage_path: storagePath,
    uploaded_by: userRes.user.id,
    drive_file_id: driveFileId,
    drive_file_url: driveFileUrl,
  });
  if (insertErr) {
    console.error('[finalizeGeneralTaskAttachment] insert failed', safeDbError(insertErr));
    await cleanupBlob(storagePath);
    return { ok: false, error: 'storage' };
  }

  revalidatePath('/tasks');
  return { ok: true, attachmentId: input.attachmentId };
}
