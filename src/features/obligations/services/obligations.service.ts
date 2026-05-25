import { createClient } from '@/lib/supabase/server';
import type { BorrowerId, CaseId, ObligationId } from '@/lib/types/branded';

import { sumMonthlyPayments, sumRemainingDebt } from '../domain/totals';
import type { BorrowerObligationsGroup, ObligationRow } from '../types';

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
      .select('*')
      .in('borrower_id', borrowerIds)
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

export async function getObligationById(id: ObligationId): Promise<ObligationRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('borrower_obligations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function borrowerIsOnCase(
  caseId: CaseId,
  borrowerId: BorrowerId,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('case_borrowers')
    .select('borrower_id')
    .eq('case_id', caseId)
    .eq('borrower_id', borrowerId)
    .maybeSingle();
  return data !== null;
}
