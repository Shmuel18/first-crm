'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getCurrentUser, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

const InputSchema = z.object({ caseId: z.uuid(), paymentId: z.uuid() });

export async function deleteFeePaymentAction(caseId: string, paymentId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('manage_collections'))) return { ok: false, error: 'unauthorized' };

  const parsed = InputSchema.safeParse({ caseId, paymentId });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('soft_delete_fee_payment', {
    p_case_id: parsed.data.caseId,
    p_payment_id: parsed.data.paymentId,
  });
  if (error || data !== true) {
    console.error('[collections] delete payment error', { code: error?.code });
    return { ok: false, error: 'unknown' };
  }

  revalidatePath(`/cases/${parsed.data.caseId}`);
  revalidatePath('/collections');
  return { ok: true };
}
