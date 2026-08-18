import { uploadCaseDocumentToDrive } from '@/features/integrations/services/drive-case-uploader';
import { createClient } from '@/lib/supabase/server';

/**
 * Best-effort: mirror an uploaded expense invoice into the case's Drive
 * "05_שונות" misc subfolder (invoices share the catch-all folder) and record the web
 * link on the expense row. NEVER throws and NEVER blocks the upload — Supabase
 * Storage is the canonical store; Drive is a convenience mirror. A replaced or
 * removed receipt's previous Drive copy is intentionally left in place (same
 * lax Drive hygiene as the documents flow).
 */
export async function mirrorReceiptToDrive(
  caseId: string,
  expenseId: string,
  file: { content: Buffer; name: string; mimeType: string },
): Promise<void> {
  try {
    const supabase = await createClient();
    // Folder naming lives in the uploader now (it resolves the client name
    // itself, and only when a folder actually has to be created).
    const out = await uploadCaseDocumentToDrive({
      caseId,
      driveFolder: 'misc',
      file,
    });
    if (!out.ok) return;

    await supabase
      .from('case_expenses')
      // receipt_drive_id (the erasable file id) + receipt_drive_url (web link).
      // The id is what the retention cron deletes by (migration 139).
      .update({ receipt_drive_url: out.webViewLink, receipt_drive_id: out.driveFileId })
      .eq('id', expenseId)
      .eq('case_id', caseId)
      .is('deleted_at', null);
  } catch (err) {
    console.error('[mirrorReceiptToDrive] best-effort mirror failed', err);
  }
}
