'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getDriveClientIfConnected } from '@/features/integrations/services/drive-case-uploader';
import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

import { applyDocumentName } from '../domain/document-name';

type Result =
  | { ok: true; fileName: string }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'validation' | 'drive_failed' | 'unknown' };

const RenameDocumentSchema = z.object({
  documentId: z.uuid(),
  caseId: z.uuid(),
  name: z.string().trim().min(1).max(200),
});

/**
 * Rename a document, in Drive and here, as one operation.
 *
 * Drive is renamed FIRST and awaited — it is the source of truth for
 * file_name: every sync pass copies the Drive name back over ours. Renaming
 * only our row would look right until the next sync silently reverted it, so a
 * Drive failure fails the whole rename instead.
 */
export async function renameDocumentAction(input: unknown): Promise<Result> {
  const parsed = RenameDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { documentId, caseId, name } = parsed.data;

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('upload_document'))) {
    return { ok: false, error: 'unauthorized' };
  }
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  const { data: doc, error: fetchErr } = await supabase
    .from('documents')
    .select('id, file_name, drive_file_id')
    .eq('id', documentId)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .maybeSingle();
  if (fetchErr) {
    console.error('[renameDocument] fetch failed', safeDbError(fetchErr));
    return { ok: false, error: 'unknown' };
  }
  if (!doc) return { ok: false, error: 'not_found' };

  const nextName = applyDocumentName(name, doc.file_name);
  if (!nextName) return { ok: false, error: 'validation' };
  if (nextName === doc.file_name) return { ok: true, fileName: nextName };

  if (doc.drive_file_id) {
    try {
      const client = await getDriveClientIfConnected();
      if (!client) return { ok: false, error: 'drive_failed' };
      await client.renameFile(doc.drive_file_id, nextName);
    } catch (err) {
      console.error('[renameDocument] drive rename failed', {
        message: err instanceof Error ? err.message : 'unknown',
      });
      return { ok: false, error: 'drive_failed' };
    }
  }

  const { error: updateErr } = await supabase
    .from('documents')
    .update({ file_name: nextName })
    .eq('id', documentId);
  if (updateErr) {
    console.error('[renameDocument] update failed', safeDbError(updateErr));
    return { ok: false, error: 'unknown' };
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true, fileName: nextName };
}
