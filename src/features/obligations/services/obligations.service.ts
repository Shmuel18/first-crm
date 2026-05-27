import { createClient } from '@/lib/supabase/server';
import type { CaseId, ObligationId } from '@/lib/types/branded';

import { sumMonthlyPayments, sumRemainingDebt } from '../domain/totals';
import type { BorrowerObligationsGroup, ObligationRow } from '../types';

export type CaseObligationsFlat = {
  /** All obligations across every borrower on the case, flattened. */
  obligations: ObligationRow[];
  /** Primary borrower's id — `null` when the case has no borrowers yet.
   *  Used as the FK target when a new obligation is created from the
   *  case-level list. Obligations are billed to a borrower in DB even
   *  though the UI treats them as case-level. */
  primaryBorrowerId: string | null;
  monthlyPaymentTotal: number;
  remainingDebtTotal: number;
};

// Explicit column list (audit-driven). Mirrors the borrower_obligations Row
// type — schema additions are gated by listing them here rather than
// auto-flowing through select('*').
const OBLIGATION_FULL_COLUMNS =
  'id, borrower_id, lender, description, loan_amount, monthly_payment, months_remaining, end_date, metadata, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by' as const;

/**
 * Lists all obligations belonging to borrowers on a case, grouped per borrower
 * with precomputed monthly and remaining-debt totals.
 *
 * Two-step query for the same reason as incomes (PostgREST embedded shape is
 * harder to rebuild than just doing the join in JS).
 */
export async function listObligationsForCase(
  caseId: CaseId,
): Promise<BorrowerObligationsGroup[]> {
  const supabase = await createClient();

  const { data: links, error: linksError } = await supabase
    .from('case_borrowers')
    .select('borrower_id, is_primary, borrower:borrowers(id, first_name, last_name, deleted_at)')
    .eq('case_id', caseId)
    .order('is_primary', { ascending: false });
  if (linksError) throw linksError;

  const activeBorrowers = (links ?? []).filter(
    (
      row,
    ): row is typeof row & {
      borrower: { id: string; first_name: string | null; last_name: string | null; deleted_at: string | null };
    } => row.borrower !== null && row.borrower.deleted_at === null,
  );

  const borrowerIds = activeBorrowers.map((r) => r.borrower.id);
  let obligations: ObligationRow[] = [];
  if (borrowerIds.length > 0) {
    const { data, error } = await supabase
      .from('borrower_obligations')
      .select(OBLIGATION_FULL_COLUMNS)
      .in('borrower_id', borrowerIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    obligations = (data ?? []) as ObligationRow[];
  }

  return activeBorrowers.map(({ borrower }) => {
    const own = obligations.filter((o) => o.borrower_id === borrower.id);
    return {
      borrowerId: borrower.id,
      borrowerName:
        [borrower.first_name, borrower.last_name].filter(Boolean).join(' ').trim() || '—',
      obligations: own,
      monthlyPaymentTotal: sumMonthlyPayments(own),
      remainingDebtTotal: sumRemainingDebt(own),
    };
  });
}

/**
 * Case-level flat listing: every obligation on the case in one array,
 * regardless of which borrower it's billed to. The UI treats obligations
 * as case-scope; the DB FK still points at a borrower (the primary is
 * the default target for new rows).
 */
export async function listObligationsFlatForCase(
  caseId: CaseId,
): Promise<CaseObligationsFlat> {
  const supabase = await createClient();

  const { data: links, error: linksError } = await supabase
    .from('case_borrowers')
    .select('borrower_id, is_primary, borrower:borrowers(id, deleted_at)')
    .eq('case_id', caseId)
    .order('is_primary', { ascending: false });
  if (linksError) throw linksError;

  const activeBorrowers = (links ?? []).filter(
    (
      row,
    ): row is typeof row & {
      borrower: { id: string; deleted_at: string | null };
    } => row.borrower !== null && row.borrower.deleted_at === null,
  );

  const primaryBorrowerId = activeBorrowers[0]?.borrower.id ?? null;
  const borrowerIds = activeBorrowers.map((r) => r.borrower.id);

  if (borrowerIds.length === 0) {
    return {
      obligations: [],
      primaryBorrowerId: null,
      monthlyPaymentTotal: 0,
      remainingDebtTotal: 0,
    };
  }

  const { data, error } = await supabase
    .from('borrower_obligations')
    .select(OBLIGATION_FULL_COLUMNS)
    .in('borrower_id', borrowerIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const obligations = (data ?? []) as ObligationRow[];

  return {
    obligations,
    primaryBorrowerId,
    monthlyPaymentTotal: sumMonthlyPayments(obligations),
    remainingDebtTotal: sumRemainingDebt(obligations),
  };
}

export async function getObligationById(id: ObligationId): Promise<ObligationRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('borrower_obligations')
    .select(OBLIGATION_FULL_COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

