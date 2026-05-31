import { uploadCaseDocumentToDrive } from '@/features/integrations/services/drive-case-uploader';
import { createClient } from '@/lib/supabase/server';

/**
 * Best-effort: mirror an uploaded expense invoice into the case's Drive
 * "05_חשבוניות_והוצאות" subfolder (feature #8, decision #3) and record the web
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
    const { data: caseRow } = await supabase
      .from('cases')
      .select('case_number, primary_borrower_id')
      .eq('id', caseId)
      .maybeSingle();
    if (!caseRow) return;

    let familyName = 'Case';
    if (caseRow.primary_borrower_id) {
      const { data: borrower } = await supabase
        .from('borrowers')
        .select('first_name, last_name')
        .eq('id', caseRow.primary_borrower_id)
        .maybeSingle();
      familyName =
        [borrower?.last_name, borrower?.first_name].filter(Boolean).join('_') || 'Case';
    }

    const out = await uploadCaseDocumentToDrive({
      caseId,
      caseNumber: caseRow.case_number,
      familyName,
      driveFolder: 'expenses',
      file,
    });
    if (!out.ok) return;

    await supabase
      .from('case_expenses')
      .update({ receipt_drive_url: out.webViewLink })
      .eq('id', expenseId)
      .eq('case_id', caseId)
      .is('deleted_at', null);
  } catch (err) {
    console.error('[mirrorReceiptToDrive] best-effort mirror failed', err);
  }
}
