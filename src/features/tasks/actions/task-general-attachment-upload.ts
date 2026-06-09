'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { fileTypeFromBuffer } from 'file-type';

import { sanitizeFilename } from '@/features/documents/domain/sanitize-filename';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/features/documents/schemas/document.schema';
import { uploadGeneralDocumentToDrive } from '@/features/integrations/services/drive-general-uploader';
import { userHasPermission } from '@/lib/auth/permissions';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

import { TASK_DOCUMENTS_BUCKET, taskAttachmentPath } from '../services/task-attachments.service';

const MAGIC_SNIFF_BYTES = 4096;

type AttachmentError = 'unauthorized' | 'validation' | 'storage' | 'unknown';

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
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
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
  storagePath: string;
  fileName: string;
  fileSize: number;
}): Promise<FinalizeGeneralTaskAttachmentResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('upload_document')) || !(await taskVisible(input.taskId))) {
    await cleanupBlob(input.storagePath);
    return { ok: false, error: 'unauthorized' };
  }
  const safeFileName = sanitizeFilename(input.fileName);
  if (!safeFileName) {
    await cleanupBlob(input.storagePath);
    return { ok: false, error: 'validation', message: 'fileRequired' };
  }

  // Sniff the magic bytes — never trust the client-declared mime type.
  const { data: signed, error: signErr } = await supabase.storage
    .from(TASK_DOCUMENTS_BUCKET)
    .createSignedUrl(input.storagePath, 60);
  if (signErr || !signed?.signedUrl) {
    await cleanupBlob(input.storagePath);
    return { ok: false, error: 'storage' };
  }
  const sniffRes = await fetch(signed.signedUrl, {
    headers: { Range: `bytes=0-${MAGIC_SNIFF_BYTES - 1}` },
  });
  if (!sniffRes.ok) {
    await cleanupBlob(input.storagePath);
    return { ok: false, error: 'storage' };
  }
  const sniffed = await fileTypeFromBuffer(Buffer.from(await sniffRes.arrayBuffer()));
  if (!sniffed || !(ALLOWED_MIME_TYPES as readonly string[]).includes(sniffed.mime)) {
    await cleanupBlob(input.storagePath);
    return { ok: false, error: 'validation', message: 'fileTypeNotAllowed' };
  }

  // Best-effort Drive copy to the standalone general folder.
  let driveFileId: string | null = null;
  let driveFileUrl: string | null = null;
  const { data: blob } = await supabase.storage
    .from(TASK_DOCUMENTS_BUCKET)
    .download(input.storagePath);
  if (blob) {
    const out = await uploadGeneralDocumentToDrive({
      file: { content: await blob.arrayBuffer(), name: safeFileName, mimeType: sniffed.mime },
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
    mime_type: sniffed.mime,
    storage_path: input.storagePath,
    uploaded_by: userRes.user.id,
    drive_file_id: driveFileId,
    drive_file_url: driveFileUrl,
  });
  if (insertErr) {
    console.error('[finalizeGeneralTaskAttachment] insert failed', safeDbError(insertErr));
    await cleanupBlob(input.storagePath);
    return { ok: false, error: 'storage' };
  }

  revalidatePath('/tasks');
  return { ok: true, attachmentId: input.attachmentId };
}
