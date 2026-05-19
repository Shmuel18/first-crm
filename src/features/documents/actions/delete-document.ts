'use server';

import { revalidatePath } from 'next/cache';

import { deleteCaseDocumentFromDrive } from '@/features/integrations/services/drive-case-uploader';
import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'unknown'; message?: string };

export async function deleteDocumentAction(
  documentId: string,
  caseId: string,
): Promise<Result> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: doc, error: fetchErr } = await supabase
    .from('documents')
    .select('id, metadata, drive_file_id')
    .eq('id', documentId)
    .eq('case_id', caseId) // defense-in-depth: doc must belong to the supplied case
    .maybeSingle();

  if (fetchErr) return { ok: false, error: 'unknown', message: fetchErr.message };
  if (!doc) return { ok: false, error: 'not_found' };

  const storagePath =
    doc.metadata && typeof doc.metadata === 'object' && 'storage_path' in doc.metadata
      ? (doc.metadata as { storage_path?: string }).storage_path
      : undefined;

  // Storage cleanup is PRIMARY. If it fails (RLS, network, race), refuse to
  // soft-delete - otherwise the doc disappears from the UI while the file
  // stays orphaned in the bucket (cost + compliance). User can retry.
  if (storagePath) {
    const { error: storageErr } = await supabase.storage
      .from('case-documents')
      .remove([storagePath]);
    if (storageErr) {
      console.error('document storage cleanup failed', {
        documentId,
        storagePath,
        err: storageErr.message,
      });
      return { ok: false, error: 'unknown', message: storageErr.message };
    }
  }

  // Drive cleanup is SECONDARY (best-effort, swallowed internally). Don't
  // block the soft-delete on it; an orphaned Drive file can be cleaned
  // manually but a phantom doc row breaks UX.
  if (doc.drive_file_id) {
    await deleteCaseDocumentFromDrive(doc.drive_file_id);
  }

  const { error: deleteErr } = await supabase
    .from('documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', documentId);

  if (deleteErr) return { ok: false, error: 'unknown', message: deleteErr.message };

  revalidatePath(`/cases/${caseId}/documents`);
  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
