'use client';

import { useState } from 'react';

import { callAction } from '@/lib/actions/call-action';

import { finalizeUploadAction } from '../actions/finalize-upload';
import { prepareUploadAction } from '../actions/prepare-upload';

export type UploadMeta = {
  categoryId: string;
  borrowerId: string | null;
  expiryDate: string | null;
  notes: string | null;
};

/** Error key per failed file; the UI maps it to a translated string. */
export type UploadFailure = { file: File; errorKey: string };

/** 1-based index of the file being uploaded now, out of the batch size. */
export type UploadProgress = { current: number; total: number } | null;

/**
 * Direct-to-storage upload of one file (batch 25):
 *   1. prepareUploadAction() returns a signed upload URL + documentId.
 *   2. The browser PUTs the bytes straight to Supabase Storage — they never
 *      pass through the Server Action body (no size limit, no memory pressure).
 *   3. finalizeUploadAction() sniffs magic bytes, copies to Drive, inserts the row.
 * Resolves to null on success, else an error key.
 */
async function uploadOne(caseId: string, file: File, meta: UploadMeta): Promise<string | null> {
  const prep = await callAction(() =>
    prepareUploadAction({
      caseId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      categoryId: meta.categoryId,
      borrowerId: meta.borrowerId,
    }),
  );
  if (!prep.ok) {
    return prep.error === 'unauthorized' ? 'uploadFailed' : (prep.message ?? 'uploadFailed');
  }

  const putRes = await fetch(prep.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
    body: file,
  });
  if (!putRes.ok) return 'uploadFailed';

  const final = await callAction(() =>
    finalizeUploadAction({
      documentId: prep.documentId,
      caseId,
      fileName: prep.safeFileName,
      fileSize: file.size,
      mimeType: file.type,
      ...meta,
    }),
  );
  return final.ok ? null : (final.message ?? 'uploadFailed');
}

/**
 * Uploads a batch one file at a time — sequential on purpose: each file is a
 * Drive round-trip in finalize, and a parallel burst of 20 would hit Drive's
 * per-user quota and the prepare_upload rate limit together.
 */
export function useMultiUpload(caseId: string): {
  progress: UploadProgress;
  uploadAll: (files: ReadonlyArray<File>, meta: UploadMeta) => Promise<UploadFailure[]>;
} {
  const [progress, setProgress] = useState<UploadProgress>(null);

  const uploadAll = async (
    files: ReadonlyArray<File>,
    meta: UploadMeta,
  ): Promise<UploadFailure[]> => {
    const failures: UploadFailure[] = [];
    try {
      for (const [i, file] of files.entries()) {
        setProgress({ current: i + 1, total: files.length });
        try {
          const errorKey = await uploadOne(caseId, file, meta);
          if (errorKey) failures.push({ file, errorKey });
        } catch {
          failures.push({ file, errorKey: 'uploadFailed' });
        }
      }
    } finally {
      setProgress(null);
    }
    return failures;
  };

  return { progress, uploadAll };
}
