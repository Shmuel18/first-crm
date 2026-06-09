import {
  finalizeTaskAttachmentUploadAction,
  prepareTaskAttachmentUploadAction,
} from '../actions/task-attachment-upload';
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
 * Upload the task's attachments after the task itself is created. A caseId
 * routes the file into the case's documents (Drive case folder); a null caseId
 * routes it to the general task-attachment store (standalone Drive folder).
 * Throws on the first failure with a code mapped by the caller.
 */
export async function runTaskAttachmentUploads(
  taskId: string,
  caseId: string | null,
  files: File[],
): Promise<void> {
  for (const file of files) {
    if (caseId) {
      const prep = await prepareTaskAttachmentUploadAction({
        taskId,
        caseId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
      if (!prep.ok) throw new Error(prep.message ?? prep.error);
      await putBlob(prep.signedUrl, file);
      const final = await finalizeTaskAttachmentUploadAction({
        taskId,
        caseId,
        documentId: prep.documentId,
        storagePath: prep.path,
        fileName: prep.safeFileName,
        fileSize: file.size,
      });
      if (!final.ok) throw new Error(final.message ?? final.error);
    } else {
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
        storagePath: prep.path,
        fileName: prep.safeFileName,
        fileSize: file.size,
      });
      if (!final.ok) throw new Error(final.message ?? final.error);
    }
  }
}
