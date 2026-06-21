import { getStatisticsSummary } from '@/features/statistics/services/statistics.service';
import { createClient } from '@/lib/supabase/server';

import type { MaaserPayment } from '../types';

// Explicit columns (never select('*')) — mirror the MaaserPayment shape.
const MAASER_PAYMENT_COLUMNS = 'id, paid_on, amount, recipient, note' as const;

export async function listMaaserPayments(): Promise<MaaserPayment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('maaser_payments')
    .select(MAASER_PAYMENT_COLUMNS)
    .is('deleted_at', null)
    .order('paid_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[maaser] list payments error', { code: error.code });
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    paidOn: r.paid_on,
    // NUMERIC comes back as a string from postgres — coerce once here.
    amount: Number(r.amount),
    recipient: r.recipient,
    note: r.note,
  }));
}

export type MaaserBasis = { grossFee: number; netFee: number };

/**
 * All-time net-fee basis for the ma'aser/chomesh obligation. Reuses the
 * is_admin()-gated statistics RPC over a deliberately wide range so the figures
 * always match what the manager sees in /statistics (net = gross − payouts).
 */
export async function getMaaserBasis(): Promise<MaaserBasis> {
  const summary = await getStatisticsSummary('custom', { from: '2000-01-01', to: '2999-12-31' });
  const gross = summary?.financial.executed_fee_total ?? 0;
  const payouts = summary?.financial.executed_payout_total ?? 0;
  return { grossFee: gross, netFee: gross - payouts };
}
