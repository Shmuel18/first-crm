import {
  getDriveClientIfConnected,
  uploadCaseDocumentToDrive,
} from '@/features/integrations/services/drive-case-uploader';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Best-effort: mirror a signed agreement PDF into the case's Drive "05_שונות"
 * folder and record the link on the agreement row. NEVER throws and never
 * blocks the signing response — Supabase Storage is the canonical store, and
 * this runs in after() of the (sessionless) public submit, so the row update
 * goes through the admin client.
 */
export async function mirrorAgreementToDrive(
  caseId: string,
  agreementId: string,
  file: { content: Buffer; name: string },
): Promise<void> {
  try {
    const out = await uploadCaseDocumentToDrive({
      caseId,
      driveFolder: 'misc',
      file: { content: file.content, name: file.name, mimeType: 'application/pdf' },
      // No user session here (public signing flow, running in after()) — without
      // this the folder lookup/naming/caching all run under RLS with no rows and
      // a brand-new case folder would be created literally named "Case".
      admin: true,
    });
    if (!out.ok) {
      console.error('[agreements] drive mirror skipped', out.reason);
      return;
    }
    const admin = createAdminClient();
    // The office can void an agreement in the seconds this upload takes. Stamp
    // the link ONLY while the row is still signed; if it was voided meanwhile,
    // undo the upload — otherwise the shared case folder keeps a document the
    // office just withdrew, and the cancelled row carries a live link to it.
    const { data: stamped } = await admin
      .from('case_agreements')
      .update({ drive_file_id: out.driveFileId, drive_file_url: out.webViewLink })
      .eq('id', agreementId)
      .eq('case_id', caseId)
      .eq('status', 'signed')
      .select('id');
    if (!stamped || stamped.length === 0) {
      console.warn('[agreements] agreement voided mid-mirror — removing the Drive copy');
      await removeAgreementFromDrive(out.driveFileId);
    }
  } catch (err) {
    console.error('[agreements] drive mirror failed', err);
  }
}

/**
 * Remove a voided agreement's Drive copy so the office folder only ever shows
 * the agreement that is actually in force. Best-effort: the Storage PDF and
 * the row are kept as the internal record of what happened, so a Drive failure
 * here is logged, never fatal.
 */
export async function removeAgreementFromDrive(driveFileId: string): Promise<void> {
  try {
    const client = await getDriveClientIfConnected();
    if (!client) {
      console.warn('[agreements] drive not connected — voided copy left in place', driveFileId);
      return;
    }
    await client.deleteFile(driveFileId);
  } catch (err) {
    console.error('[agreements] drive delete failed', err);
  }
}
