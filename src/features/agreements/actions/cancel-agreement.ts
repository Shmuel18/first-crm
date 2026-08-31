'use server';

import { after } from 'next/server';
import { z } from 'zod';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { removeAgreementFromDrive } from '../services/agreement-drive.service';

const Schema = z.object({ caseId: z.uuid(), agreementId: z.uuid() });

export type CancelAgreementResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'not_found' | 'unknown' };

/**
 * Withdraws an outstanding signing link, OR voids an agreement that was
 * already signed — the office needs the latter when a signed document turns
 * out to have a mistake in it (wrong rate, wrong name) and has to be re-sent.
 *
 * Voiding is not deletion: the row and the stored PDF stay as the internal
 * record of what happened, and only the Drive copy is removed so the shared
 * case folder shows just the agreement that is actually in force. With the
 * row flipped to 'cancelled', the section falls back to "not sent" and a
 * corrected agreement can be sent immediately.
 */
export async function cancelAgreementAction(
  caseId: string,
  agreementId: string,
): Promise<CancelAgreementResult> {
  const parsed = Schema.safeParse({ caseId, agreementId });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const authorized =
    (await userHasPermission('send_client_agreement')) && (await userCanEditCase(caseId));
  if (!authorized) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('case_agreements')
    .update({ status: 'cancelled' })
    .eq('id', parsed.data.agreementId)
    .eq('case_id', parsed.data.caseId)
    .neq('status', 'cancelled')
    .select('drive_file_id');
  if (error) {
    console.error('[cancelAgreement] update failed', error.code);
    return { ok: false, error: 'unknown' };
  }
  if (!data || data.length === 0) return { ok: false, error: 'not_found' };

  // Drive is a full HTTP round-trip and must not hold the button — the row is
  // already voided, which is what the user actually asked for.
  const driveFileId = data[0]?.drive_file_id ?? null;
  if (driveFileId) after(async () => removeAgreementFromDrive(driveFileId));

  return { ok: true };
}
