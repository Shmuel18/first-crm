'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'case-documents';

export type ReceiptUrlResult =
  | { ok: true; url: string; mime: string | null; name: string | null }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'unknown' };

/**
 * Short-lived signed URL to view an expense's invoice (feature #8). The expense
 * row is fetched with the USER client first, so the case_expenses SELECT RLS
 * (can_view_case) is the access gate; only if the caller may see the row do we
 * mint the URL with the admin client (the bucket's SELECT RLS requires
 * view_case_documents, which we deliberately don't couple receipts to). 60s
 * TTL — a signed URL is an unauthenticated bearer token for its whole lifetime.
 */
export async function getExpenseReceiptUrlAction(
  expenseId: string,
  caseId: string,
): Promise<ReceiptUrlResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: row, error } = await supabase
    .from('case_expenses')
    .select('receipt_path, receipt_name, receipt_mime')
    .eq('id', expenseId)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    console.error('[getExpenseReceiptUrl] fetch failed', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }
  if (!row?.receipt_path) return { ok: false, error: 'not_found' };

  const admin = createAdminClient();
  const { data, error: urlErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(row.receipt_path, 60);
  if (urlErr || !data) {
    console.error('[getExpenseReceiptUrl] sign failed', urlErr);
    return { ok: false, error: 'unknown' };
  }

  return { ok: true, url: data.signedUrl, mime: row.receipt_mime, name: row.receipt_name };
}
