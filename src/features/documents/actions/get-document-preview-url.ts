'use server';

import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true; url: string; mimeType: string | null; fileName: string }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'unknown'; message?: string };

export async function getDocumentPreviewUrlAction(
  documentId: string,
): Promise<Result> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // Defense-in-depth fast-fail to match the other document actions; RLS
  // (documents_select) is still the row-level control.
  if (!(await userHasPermission('view_case_documents'))) {
    return { ok: false, error: 'unauthorized' };
  }

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, file_name, mime_type, metadata')
    .eq('id', documentId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return { ok: false, error: 'unknown', message: error.message };
  if (!doc) return { ok: false, error: 'not_found' };

  const storagePath =
    doc.metadata && typeof doc.metadata === 'object' && 'storage_path' in doc.metadata
      ? (doc.metadata as { storage_path?: string }).storage_path
      : undefined;

  if (!storagePath) return { ok: false, error: 'not_found' };

  const { data, error: urlErr } = await supabase.storage
    .from('case-documents')
    .createSignedUrl(storagePath, 300);

  if (urlErr || !data) {
    return { ok: false, error: 'unknown', message: urlErr?.message };
  }

  return {
    ok: true,
    url: data.signedUrl,
    mimeType: doc.mime_type,
    fileName: doc.file_name,
  };
}
