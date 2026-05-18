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
    .maybeSingle();

  if (fetchErr) return { ok: false, error: 'unknown', message: fetchErr.message };
  if (!doc) return { ok: false, error: 'not_found' };

  const storagePath =
    doc.metadata && typeof doc.metadata === 'object' && 'storage_path' in doc.metadata
      ? (doc.metadata as { storage_path?: string }).storage_path
      : undefined;

  if (storagePath) {
    await supabase.storage.from('case-documents').remove([storagePath]);
  }
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
