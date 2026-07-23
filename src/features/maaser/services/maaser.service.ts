import { createClient } from '@/lib/supabase/server';

import type { MaaserEntry, MaaserPayment } from '../types';

// Explicit columns (never select('*')) — mirror the app-level shapes.
const MAASER_PAYMENT_COLUMNS = 'id, paid_on, amount, recipient, note' as const;
const MAASER_ENTRY_COLUMNS = 'id, entry_date, kind, amount, description' as const;

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

export async function listMaaserEntries(): Promise<MaaserEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('maaser_ledger_entries')
    .select(MAASER_ENTRY_COLUMNS)
    .is('deleted_at', null)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[maaser] list entries error', { code: error.code });
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    entryDate: r.entry_date,
    // DB CHECK constrains kind to income|expense; narrow defensively.
    kind: r.kind === 'expense' ? 'expense' : 'income',
    amount: Number(r.amount),
    description: r.description,
  }));
}

/** Automatic side of the ma'aser base: money actually collected and the office
 *  expenses to net against it. Manual income/expense lines are added on top in
 *  the view. */
export type MaaserBasis = { collected: number; autoExpenses: number };

/**
 * All-time collected-fee basis for the ma'aser/chomesh obligation. Goes through
 * the is_admin()-gated maaser_income_basis() RPC (migration 220) so the figures
 * follow money ACTUALLY received (the גבייה ledger), not the agreed fee — the
 * obligation only grows once the money is in.
 */
export async function getMaaserBasis(): Promise<MaaserBasis> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('maaser_income_basis');

  if (error) {
    console.error('[maaser] income basis rpc error', { code: error.code });
    return { collected: 0, autoExpenses: 0 };
  }

  const row = data?.[0];
  return {
    collected: Number(row?.collected ?? 0),
    autoExpenses: Number(row?.expenses ?? 0),
  };
}
