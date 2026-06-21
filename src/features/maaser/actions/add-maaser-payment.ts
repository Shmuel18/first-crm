'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { AddMaaserPaymentSchema, type AddMaaserPaymentInput } from '../schemas/maaser.schema';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

export async function addMaaserPaymentAction(input: AddMaaserPaymentInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const parsed = AddMaaserPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { error } = await supabase.from('maaser_payments').insert({
    paid_on: parsed.data.paidOn,
    amount: parsed.data.amount,
    recipient: parsed.data.recipient?.trim() || null,
    note: parsed.data.note?.trim() || null,
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) {
    console.error('[maaser] add payment error', { code: error.code });
    return { ok: false, error: 'unknown' };
  }

  revalidatePath('/maaser');
  return { ok: true };
}
