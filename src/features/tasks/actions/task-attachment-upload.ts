'use server';

import { randomUUID } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { fileTypeFromBuffer } from 'file-type';

import { uploadCaseDocumentToDrive } from '@/features/integrations/services/drive-case-uploader';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/features/documents/schemas/document.schema';
import { DOCUMENTS_BUCKET, storagePathFor } from '@/features/documents/services/documents.service';
import { sanitizeFilename } from '@/features/documents/domain/sanitize-filename';
import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

const MAGIC_SNIFF_BYTES = 4096;
const TASK_ATTACHMENT_DRIVE_FOLDER = 'misc';

export type PrepareTaskAttachmentInput = {
  taskId: string;
  caseId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

export type PrepareTaskAttachmentResult =
  | {
      ok: true;
      documentId: string;
      path: string;
      signedUrl: string;
      safeFileName: string;
    }
  | { ok: false; error: 'unauthorized' | 'validation' | 'storage' | 'rate_limited' | 'unknown'; message?: string };

export type FinalizeTaskAttachmentInput = {
  taskId: string;
  caseId: string;
  documentId: string;
  fileName: string;
  fileSize: number;
};

export type FinalizeTaskAttachmentResult =
  | { ok: true; documentId: string }
  | { ok: false; error: 'unauthorized' | 'validation' | 'storage' | 'unknown'; message?: string };

export async function prepareTaskAttachmentUploadAction(
  input: PrepareTaskAttachmentInput,
): Promise<PrepareTaskAttachmentResult> {
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

  if (!(await userHasPermission('upload_document')) || !(await userCanEditCase(input.caseId))) {
    return { ok: false, error: 'unauthorized' };
  }

  const taskOk = await taskBelongsToVisibleCase(input.taskId, input.caseId);
  if (!taskOk) return { ok: false, error: 'unauthorized' };

  // Throttle the upload prepare (gates the expensive finalize) per user (TASK-ATT-6).
  const allowed = await checkRateLimit({
    action: 'prepare_task_attachment',
    subject: `user:${userRes.user.id}`,
    max: 120,
    windowSeconds: 60,
    failMode: 'closed',
  });
  if (!allowed) return { ok: false, error: 'rate_limited' };

  const documentId = randomUUID();
  const path = storagePathFor(input.caseId, documentId, safeFileName);
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error('[prepareTaskAttachmentUpload] signed url failed', safeDbError(error));
    return { ok: false, error: 'storage' };
  }

  return {
    ok: true,
    documentId,
    path,
    signedUrl: data.signedUrl,
    safeFileName,
  };
}

export async function finalizeTaskAttachmentUploadAction(
  input: FinalizeTaskAttachmentInput,
): Promise<FinalizeTaskAttachmentResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // Recompute the storage path server-side from the authz'd caseId + documentId
  // + sanitized filename — never trust the client path (cross-case binding;
  // R13 TASK-ATT-1).
  const safeFileName = sanitizeFilename(input.fileName);
  if (!safeFileName) {
    return { ok: false, error: 'validation', message: 'fileRequired' };
  }
  const storagePath = storagePathFor(input.caseId, input.documentId, safeFileName);

  if (!(await userHasPermission('upload_document')) || !(await userCanEditCase(input.caseId))) {
    await cleanupBlob(storagePath);
    return { ok: false, error: 'unauthorized' };
  }

  const taskOk = await taskBelongsToVisibleCase(input.taskId, input.caseId);
  if (!taskOk) {
    await cleanupBlob(storagePath);
    return { ok: false, error: 'unauthorized' };
  }

  const ctx = await resolveAttachmentContext(input.caseId);
  if (!ctx) {
    await cleanupBlob(storagePath);
    return { ok: false, error: 'unauthorized' };
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, 60);
  if (signErr || !signed?.signedUrl) {
    console.error('[finalizeTaskAttachmentUpload] failed to sign read URL', signErr);
    await cleanupBlob(storagePath);
    return { ok: false, error: 'storage' };
  }

  const sniffRes = await fetch(signed.signedUrl, {
    headers: { Range: `bytes=0-${MAGIC_SNIFF_BYTES - 1}` },
  });
  if (!sniffRes.ok) {
    console.error('[finalizeTaskAttachmentUpload] sniff fetch failed', sniffRes.status);
    await cleanupBlob(storagePath);
    return { ok: false, error: 'storage' };
  }

  const sniffed = await fileTypeFromBuffer(Buffer.from(await sniffRes.arrayBuffer()));
  if (!sniffed || !(ALLOWED_MIME_TYPES as readonly string[]).includes(sniffed.mime)) {
    await cleanupBlob(storagePath);
    return { ok: false, error: 'validation', message: 'fileTypeNotAllowed' };
  }

  let driveFileId: string | null = null;
  let driveFileUrl: string | null = null;
  const { data: blob, error: dlErr } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .download(storagePath);
  if (!dlErr && blob) {
    const out = await uploadCaseDocumentToDrive({
      caseId: input.caseId,
      caseNumber: ctx.caseNumber,
      familyName: ctx.familyName,
      driveFolder: TASK_ATTACHMENT_DRIVE_FOLDER,
      file: { content: await blob.arrayBuffer(), name: safeFileName, mimeType: sniffed.mime },
    });
    if (out.ok) {
      driveFileId = out.driveFileId;
      driveFileUrl = out.webViewLink;
    }
  }

  const { error: insertErr } = await supabase.from('documents').insert({
    id: input.documentId,
    case_id: input.caseId,
    category_id: null,
    borrower_id: null,
    file_name: safeFileName,
    file_size: input.fileSize,
    mime_type: sniffed.mime,
    notes: null,
    uploaded_by: userRes.user.id,
    status: 'new',
    metadata: {
      storage_path: storagePath,
      source: 'task_attachment',
      task_id: input.taskId,
    },
    drive_file_id: driveFileId,
    drive_file_url: driveFileUrl,
  });

  if (insertErr) {
    console.error('[finalizeTaskAttachmentUpload] insert failed', safeDbError(insertErr));
    await cleanupBlob(storagePath);
    return { ok: false, error: 'storage' };
  }

  revalidatePath('/tasks');
  revalidatePath(`/cases/${input.caseId}`);
  revalidatePath(`/cases/${input.caseId}/documents`);
  return { ok: true, documentId: input.documentId };
}

async function taskBelongsToVisibleCase(taskId: string, caseId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .eq('case_id', caseId)
    .maybeSingle();
  if (error) {
    console.error('[taskAttachmentUpload] task lookup failed', safeDbError(error));
    return false;
  }
  return Boolean(data);
}

async function resolveAttachmentContext(
  caseId: string,
): Promise<{ caseNumber: string; familyName: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cases')
    .select('case_number, primary_borrower:primary_borrower_id(first_name, last_name)')
    .eq('id', caseId)
    .maybeSingle();
  if (error || !data) return null;

  const borrower = Array.isArray(data.primary_borrower)
    ? data.primary_borrower[0]
    : data.primary_borrower;
  const familyName =
    [borrower?.last_name, borrower?.first_name].filter(Boolean).join('_') || 'Case';

  return { caseNumber: data.case_number, familyName };
}

async function cleanupBlob(path: string): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]).catch(() => undefined);
}
