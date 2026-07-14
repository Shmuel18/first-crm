import {
  finalizeGeneralTaskAttachmentAction,
  prepareGeneralTaskAttachmentAction,
} from '../actions/task-general-attachment-upload';

async function putBlob(signedUrl: string, file: File): Promise<void> {
  const res = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
    body: file,
  });
  if (!res.ok) throw new Error('uploadFailed');
}

/**
 * Upload voice-note recordings for a task. Always routes through the general
 * task-attachment store (task_attachments), ignoring case linkage — audio must
 * never enter the case-documents system. Throws on the first failure with a code
 * the caller maps to a translated message.
 */
export async function runTaskRecordingUploads(taskId: string, files: File[]): Promise<void> {
  for (const file of files) {
    const prep = await prepareGeneralTaskAttachmentAction({
      taskId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
    if (!prep.ok) throw new Error(prep.message ?? prep.error);
    await putBlob(prep.signedUrl, file);
    const final = await finalizeGeneralTaskAttachmentAction({
      taskId,
      attachmentId: prep.attachmentId,
      fileName: prep.safeFileName,
      fileSize: file.size,
      mimeType: file.type,
    });
    if (!final.ok) throw new Error(final.message ?? final.error);
  }
}
