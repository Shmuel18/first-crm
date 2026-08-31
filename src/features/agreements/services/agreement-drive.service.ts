import { uploadCaseDocumentToDrive } from '@/features/integrations/services/drive-case-uploader';
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
    await admin
      .from('case_agreements')
      .update({ drive_file_id: out.driveFileId, drive_file_url: out.webViewLink })
      .eq('id', agreementId)
      .eq('case_id', caseId);
  } catch (err) {
    console.error('[agreements] drive mirror failed', err);
  }
}
