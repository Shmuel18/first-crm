'use server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

export type EmailDocumentOption = {
  id: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
};

type Result =
  | { ok: true; documents: EmailDocumentOption[] }
  | { ok: false; error: 'unauthorized' | 'unknown' };

/**
 * Lists the case's attachable documents for the "attach from case" picker in
 * the client-email dialog. Lazy-loaded when the picker opens (keeps the doc
 * query off every case-page render). Only documents with a Storage blob are
 * returned — Drive-only rows have nothing to attach. Auth mirrors the send
 * action (must be able to edit the case).
 */
export async function listCaseDocumentsForEmailAction(caseId: string): Promise<Result> {
  if (typeof caseId !== 'string' || caseId.length === 0) {
    return { ok: false, error: 'unauthorized' };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  const { data, error } = await supabase
    .from('documents')
    .select('id, file_name, mime_type, file_size, metadata')
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .order('upload_date', { ascending: false });
  if (error) {
    console.error('[listCaseDocumentsForEmail] fetch failed', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }

  const documents: EmailDocumentOption[] = (data ?? [])
    .filter(
      (d) =>
        d.metadata &&
        typeof d.metadata === 'object' &&
        'storage_path' in d.metadata &&
        Boolean((d.metadata as { storage_path?: string }).storage_path),
    )
    .map((d) => ({
      id: d.id,
      fileName: d.file_name,
      mimeType: d.mime_type,
      fileSize: d.file_size,
    }));

  return { ok: true, documents };
}
