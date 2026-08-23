'use server';

import { z } from 'zod';

import { getDriveClientIfConnected } from '@/features/integrations/services/drive-case-uploader';
import { userHasPermission } from '@/lib/auth/permissions';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

import { isDirectlyPrintable } from '../domain/printable';

type Result =
  | { ok: true; base64: string; mimeType: string }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'too_large' | 'not_printable' | 'unknown' };

/**
 * Printing needs the actual bytes, and a file that only ever lived in Drive
 * has no Storage blob to sign — the same gap that made those documents
 * unattachable. The browser can't fetch from Drive itself (no token, and CORS
 * would block it), so the bytes come back through here.
 *
 * base64-in-JSON rather than a redirect to a file URL: the office's network
 * filter rejects file-download responses with a fake 403, and a JSON body
 * passes it. The client rebuilds a blob and prints that.
 */
const MAX_PRINT_BYTES = 15 * 1024 * 1024;

export async function getDocumentPrintBytesAction(documentId: string): Promise<Result> {
  if (!z.uuid().safeParse(documentId).success) return { ok: false, error: 'not_found' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('view_case_documents'))) {
    return { ok: false, error: 'unauthorized' };
  }

  // RLS (documents_select) is the row-level control — a doc on a case the
  // caller can't see simply isn't returned.
  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, mime_type, file_size, drive_file_id')
    .eq('id', documentId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    console.error('[getDocumentPrintBytes] fetch failed', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }
  if (!doc?.drive_file_id) return { ok: false, error: 'not_found' };
  // Office formats have no browser renderer; the caller opens Drive instead.
  if (!isDirectlyPrintable(doc.mime_type)) return { ok: false, error: 'not_printable' };
  if (doc.file_size && doc.file_size > MAX_PRINT_BYTES) return { ok: false, error: 'too_large' };

  const client = await getDriveClientIfConnected();
  if (!client) return { ok: false, error: 'unknown' };

  try {
    const buf = await client.downloadFileBytes(doc.drive_file_id);
    if (buf.byteLength > MAX_PRINT_BYTES) return { ok: false, error: 'too_large' };
    return { ok: true, base64: buf.toString('base64'), mimeType: doc.mime_type ?? '' };
  } catch (err) {
    console.error('[getDocumentPrintBytes] drive download failed', {
      message: err instanceof Error ? err.message : 'unknown',
    });
    return { ok: false, error: 'unknown' };
  }
}
