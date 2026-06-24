'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getCurrentUser, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { AddFeePaymentSchema, type AddFeePaymentInput } from '../schemas/fee-payment.schema';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

export async function addFeePaymentAction(input: AddFeePaymentInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('manage_collections'))) return { ok: false, error: 'unauthorized' };

  const parsed = AddFeePaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  // case_fee_payments isn't in the generated Database types until the next
  // gen-types — write through an untyped handle (RLS still enforces the gate).
  const db = supabase as unknown as SupabaseClient;
  const { error } = await db.from('case_fee_payments').insert({
    case_id: parsed.data.caseId,
    paid_on: parsed.data.paidOn ?? null,
    amount: parsed.data.amount,
    payment_method: parsed.data.paymentMethod ?? null,
    label: parsed.data.label?.trim() || null,
    note: parsed.data.note?.trim() || null,
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) {
    console.error('[collections] add payment error', { code: error.code });
    return { ok: false, error: 'unknown' };
  }

  revalidatePath(`/cases/${parsed.data.caseId}`);
  revalidatePath('/collections');
  return { ok: true };
}
