'use server';

import { z } from 'zod';

import { getCaseCollectionsData } from '@/features/collections/services/collections.service';
import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { asCaseId } from '@/lib/types/branded';

import { AGREEMENT_VERSION } from '../constants';
import { getAgreementClientSnapshot } from '../services/agreements.service';

const Schema = z.object({ caseId: z.uuid() });

export type MarkAgreementSignedResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'no_borrower' | 'unknown' };

/**
 * The plain "the client signed" checkbox — for agreements signed on paper /
 * in person, outside the digital flow. Records a 'signed' row with
 * signed_method='manual' (no token, no email) and supersedes any outstanding
 * signing link. The fee snapshot is best-effort from case_financials: without
 * view_case_fee RLS nulls it and the record simply says 0 — the manual mark
 * is a checkbox, not a fee document.
 */
export async function markAgreementSignedAction(
  caseId: string,
): Promise<MarkAgreementSignedResult> {
  const parsed = Schema.safeParse({ caseId });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const authorized =
    (await userHasPermission('manage_collections')) && (await userCanEditCase(caseId));
  if (!authorized) return { ok: false, error: 'unauthorized' };

  const snapshot = await getAgreementClientSnapshot(caseId);
  if (!snapshot) return { ok: false, error: 'no_borrower' };

  const { feeAmount, advanceAmount } = await getCaseCollectionsData(asCaseId(caseId));
  const feeTotal = feeAmount ?? 0;
  const feeAdvance = Math.min(advanceAmount ?? 0, feeTotal);

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
    fee_total: feeTotal,
    fee_advance: feeAdvance,
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
