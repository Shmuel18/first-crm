'use server';

import { z } from 'zod';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

const Schema = z.object({ caseId: z.uuid(), agreementId: z.uuid() });

export type CancelAgreementResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'not_found' | 'unknown' };

/**
 * Withdraws an outstanding signing link, or reverts a MANUAL "signed" mark
 * made by mistake. A digitally-signed agreement is evidence and cannot be
 * cancelled from the UI — the .or() filter below excludes it.
 */
export async function cancelAgreementAction(
  caseId: string,
  agreementId: string,
): Promise<CancelAgreementResult> {
  const parsed = Schema.safeParse({ caseId, agreementId });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const authorized =
    (await userHasPermission('manage_collections')) && (await userCanEditCase(caseId));
  if (!authorized) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('case_agreements')
    .update({ status: 'cancelled' })
    .eq('id', parsed.data.agreementId)
    .eq('case_id', parsed.data.caseId)
    .or('status.eq.sent,and(status.eq.signed,signed_method.eq.manual)')
    .select('id');
  if (error) {
    console.error('[cancelAgreement] update failed', error.code);
    return { ok: false, error: 'unknown' };
  }
  if (!data || data.length === 0) return { ok: false, error: 'not_found' };
  return { ok: true };
}
