import { createClient } from '@/lib/supabase/server';
import type { CaseId } from '@/lib/types/branded';

import { isPaymentMethod } from '../domain/payment-methods';
import type { CollectionOverviewRow, FeePayment } from '../types';

// Explicit column list (never select('*')) mirroring the case_fee_payments Row.
const FEE_PAYMENT_COLUMNS =
  'id, case_id, paid_on, amount, payment_method, label, note' as const;

/**
 * Active (non-soft-deleted) fee payments for a case, newest first. RLS gates on
 * view_collections (migration 206) — a caller without it reads [].
 */
export async function listCaseFeePayments(caseId: CaseId): Promise<FeePayment[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('case_fee_payments')
    .select(FEE_PAYMENT_COLUMNS)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .order('paid_on', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[collections] list payments error', { code: error.code });
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    caseId: r.case_id,
    paidOn: r.paid_on,
    // NUMERIC can come back as a string from postgres — coerce once here.
    amount: Number(r.amount),
    paymentMethod: r.payment_method && isPaymentMethod(r.payment_method) ? r.payment_method : null,
    label: r.label,
    note: r.note,
  }));
}

/**
 * Fee + advance_agreed flag for a case, used by the מנהלה collections block.
 * Returns null for feeAmount when unset or caller lacks view_case_fee (RLS
 * nulls the row). advance_agreed is false when the row is missing.
 */
export async function getCaseCollectionsData(
  caseId: CaseId,
): Promise<{ feeAmount: number | null; advanceAgreed: boolean }> {
  const supabase = await createClient();
  // advance_agreed added in migration 210 — not yet in database.ts; cast the result.
  type Row = { fee_amount: number | null; advance_agreed: boolean };
  const raw = await supabase
    .from('case_financials')
    .select('fee_amount, advance_agreed')
    .eq('case_id', caseId)
    .maybeSingle();
  const { data, error } = raw as unknown as {
    data: Row | null;
    error: { code: string } | null;
  };

  if (error) {
    console.error('[collections] case data error', { code: error.code });
    return { feeAmount: null, advanceAgreed: false };
  }
  return {
    feeAmount: data?.fee_amount == null ? null : Number(data.fee_amount),
    advanceAgreed: Boolean(data?.advance_agreed ?? false),
  };
}

/**
 * Per-case aggregates for the global dashboard. Goes through the
 * collections_overview() SECURITY DEFINER RPC (migration 206) so a collections
 * officer without view_case_fee still sees aggregate fee totals; the RPC gates
 * on view_collections itself.
 */
export async function getCollectionsOverview(): Promise<CollectionOverviewRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('collections_overview');
  if (error) {
    console.error('[collections] overview rpc error', { code: error.code });
    return [];
  }

  // case_status + advance_agreed added in migration 210; cast until database.ts regenerated.
  type RpcRow = (typeof data)[number] & { case_status?: string; advance_agreed?: boolean };
  return (data ?? []).map((r: RpcRow) => ({
    caseId: r.case_id,
    caseNumber: r.case_number,
    borrowers: r.borrowers,
    caseStatus: r.case_status ?? '',
    feeAmount: r.fee_amount == null ? null : Number(r.fee_amount),
    advanceAgreed: Boolean(r.advance_agreed ?? false),
    collected: Number(r.collected ?? 0),
    expenses: Number(r.expenses ?? 0),
    paymentCount: Number(r.payment_count ?? 0),
    lastPaymentOn: r.last_payment_on,
  }));
}
