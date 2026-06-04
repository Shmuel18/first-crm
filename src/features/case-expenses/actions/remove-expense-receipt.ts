'use server';

import { eraseDriveTargets } from '@/features/integrations/services/drive-case-uploader';
import { userCanEditCase } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'case-documents';

export type RemoveReceiptResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'unknown' };

/**
 * Detaches the invoice from an expense (feature #8): clears the pointer columns
 * and erases the Storage blob + Drive copy immediately. This is an explicit
 * user erase (not a soft-delete), so the retention cron won't pick it up — we
 * erase the files here. No revalidatePath — the cell clears its own state
 * optimistically.
 */
export async function removeExpenseReceiptAction(
  expenseId: string,
  caseId: string,
): Promise<RemoveReceiptResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  const { data: existing, error: fetchErr } = await supabase
    .from('case_expenses')
    .select('receipt_path, receipt_drive_id')
    .eq('id', expenseId)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .maybeSingle();
  if (fetchErr) {
    console.error('[removeExpenseReceipt] fetch failed', safeDbError(fetchErr));
    return { ok: false, error: 'unknown' };
  }
  const path = existing?.receipt_path ?? null;
  const driveId = existing?.receipt_drive_id ?? null;

  const { error: updErr } = await supabase
    .from('case_expenses')
    .update({
      receipt_path: null,
      receipt_name: null,
      receipt_mime: null,
      receipt_drive_url: null,
      receipt_drive_id: null,
      updated_by: userRes.user.id,
    })
    .eq('id', expenseId)
    .eq('case_id', caseId)
    .is('deleted_at', null);
  if (updErr) {
    console.error('[removeExpenseReceipt] update failed', safeDbError(updErr));
    return { ok: false, error: 'unknown' };
  }

  // Erase the blob + Drive copy (best-effort — pointers are already cleared, so
  // a failure here just leaves a file for manual cleanup, never a dangling ref).
  if (path) {
    const admin = createAdminClient();
    await admin.storage.from(BUCKET).remove([path]).catch(() => undefined);
  }
  if (driveId) {
    await eraseDriveTargets({ fileIds: [driveId] }).catch(() => undefined);
  }

  return { ok: true };
}
