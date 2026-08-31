'use server';

import { z } from 'zod';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { AGREEMENT_VERSION } from '../constants';
import { getAgreementClientSnapshot } from '../services/agreements.service';

const Schema = z.object({ caseId: z.uuid() });

export type MarkAgreementSignedResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'no_borrower' | 'unknown' };

/**
 * The plain "the client signed" mark — for agreements signed on paper or in
 * person, outside the digital flow. Records a 'signed' row with
 * signed_method='manual' (no token, no email, no document) and supersedes any
 * outstanding signing link.
 *
 * Gated on send_client_agreement to MATCH the migration-239 INSERT policy:
 * checking a different permission than RLS enforces would let the action
 * accept a caller the database then rejects (and refuse one it would accept).
 *
 * No commercial terms are recorded: nothing was generated, so there is no
 * percentage, no printed estimate and no advance to snapshot. Inventing
 * numbers here would put figures on a record that no document backs.
 */
export async function markAgreementSignedAction(
  caseId: string,
): Promise<MarkAgreementSignedResult> {
  const parsed = Schema.safeParse({ caseId });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const authorized =
    (await userHasPermission('send_client_agreement')) && (await userCanEditCase(caseId));
  if (!authorized) return { ok: false, error: 'unauthorized' };

  const snapshot = await getAgreementClientSnapshot(caseId);
  if (!snapshot) return { ok: false, error: 'no_borrower' };

  const supabase = await createClient();
  // A paper signature supersedes any live link.
  await supabase
    .from('case_agreements')
    .update({ status: 'cancelled' })
    .eq('case_id', caseId)
    .eq('status', 'sent');

  const { data: userRes } = await supabase.auth.getUser();
  const { error } = await supabase.from('case_agreements').insert({
    case_id: caseId,
    status: 'signed',
    signed_method: 'manual',
    agreement_version: AGREEMENT_VERSION,
    client_name: snapshot.name,
    client_national_id: snapshot.nationalId,
    client_phone: snapshot.phone,
    client_email: snapshot.email,
    sent_by: userRes.user?.id ?? null,
    signed_at: new Date().toISOString(),
  });
  if (error) {
    console.error('[markAgreementSigned] insert failed', error.code);
    return { ok: false, error: 'unknown' };
  }
  return { ok: true };
}
