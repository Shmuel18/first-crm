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
 * Fee + advance + office expenses + execution status for a case, used by the
 * מנהלה collections block to show the full outstanding balance (fee + expenses).
 * Returns null feeAmount when unset / RLS-nulled; expenses 0 when none.
 */
export async function getCaseCollectionsData(caseId: CaseId): Promise<{
  feeAmount: number | null;
  advanceAmount: number | null;
  expenses: number;
  isExecution: boolean;
}> {
  const supabase = await createClient();
  const [finRaw, expRes, caseRes, execRes] = await Promise.all([
    // advance_amount added in migration 212 — not yet in database.ts; cast the result.
    supabase.from('case_financials').select('fee_amount, advance_amount').eq('case_id', caseId).maybeSingle(),
    supabase.from('case_expenses').select('amount').eq('case_id', caseId).is('deleted_at', null),
    supabase.from('cases').select('status_id').eq('id', caseId).maybeSingle(),
    supabase.from('case_statuses').select('id').eq('key', 'execution').maybeSingle(),
  ]);
  const { data, error } = finRaw as unknown as {
    data: { fee_amount: number | null; advance_amount: number | null } | null;
    error: { code: string } | null;
  };

  if (error) {
    console.error('[collections] case data error', { code: error.code });
    return { feeAmount: null, advanceAmount: null, expenses: 0, isExecution: false };
  }

  const expenses = (expRes.data ?? []).reduce((acc, e) => acc + Number(e.amount), 0);
  const isExecution = Boolean(
    caseRes.data?.status_id && execRes.data?.id && caseRes.data.status_id === execRes.data.id,
  );

  return {
    feeAmount: data?.fee_amount == null ? null : Number(data.fee_amount),
    advanceAmount: data?.advance_amount == null ? null : Number(data.advance_amount),
    expenses,
    isExecution,
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

  // case_status/advance_agreed/advance_amount added in migs 210-212; cast until database.ts regenerated.
  type RpcRow = (typeof data)[number] & {
    case_status?: string;
    advance_agreed?: boolean;
    advance_amount?: number | null;
  };
  return (data ?? []).map((r: RpcRow) => ({
    caseId: r.case_id,
    caseNumber: r.case_number,
    borrowers: r.borrowers,
    caseStatus: r.case_status ?? '',
    feeAmount: r.fee_amount == null ? null : Number(r.fee_amount),
    advanceAmount: r.advance_amount == null ? null : Number(r.advance_amount),
    collected: Number(r.collected ?? 0),
    expenses: Number(r.expenses ?? 0),
    paymentCount: Number(r.payment_count ?? 0),
    lastPaymentOn: r.last_payment_on,
  }));
}
