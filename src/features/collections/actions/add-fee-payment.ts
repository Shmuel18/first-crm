'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUser, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { AddFeePaymentSchema, type AddFeePaymentInput } from '../schemas/fee-payment.schema';

type Result = { ok: true; id: string } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

export async function addFeePaymentAction(input: AddFeePaymentInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('manage_collections'))) return { ok: false, error: 'unauthorized' };

  const parsed = AddFeePaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  // Return the new id so the caller can update its list optimistically.
  const { data, error } = await supabase
    .from('case_fee_payments')
    .insert({
      case_id: parsed.data.caseId,
      paid_on: parsed.data.paidOn ?? null,
      amount: parsed.data.amount,
      payment_method: parsed.data.paymentMethod ?? null,
      label: parsed.data.label?.trim() || null,
      note: parsed.data.note?.trim() || null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[collections] add payment error', { code: error?.code });
    return { ok: false, error: 'unknown' };
  }

  // NOT revalidatePath(/cases/[id]) — that re-renders the whole heavy case page
  // and scroll-jumps to the top after every add. The case block updates its list
  // optimistically instead. /collections is a different route, safe to revalidate.
  revalidatePath('/collections');
  return { ok: true, id: data.id };
}
