import { createClient } from '@/lib/supabase/server';
import type { BorrowerId, CaseId, IncomeId } from '@/lib/types/branded';

import { sumMonthlyIncomes } from '../domain/totals';
import type { BorrowerIncomesGroup, IncomeRow, IncomeTypeOption, IncomeWithType } from '../types';

const INCOME_SELECT = `
  *,
  income_type:income_types(id, key, name_he, name_en)
` as const;

/**
 * Lists all incomes belonging to borrowers on a case, grouped per borrower
 * with a precomputed monthly total. RLS filters out incomes the caller can't
 * see, so unauthorized callers simply get empty arrays without an error.
 *
 * Two-step query (borrower IDs → incomes) instead of a single nested fetch,
 * because PostgREST embeds at the foreign-key level and case_borrowers ↔
 * borrowers ↔ borrower_incomes would surface the array shape we'd need to
 * rebuild anyway. Two round-trips are cheaper than the post-processing.
 */
export async function listIncomesForCase(caseId: CaseId): Promise<BorrowerIncomesGroup[]> {
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

  // Skip the incomes round-trip if there are no live borrowers — supabase's
  // .in([]) sends "in.()" which PostgREST rejects.
  const borrowerIds = activeBorrowers.map((r) => r.borrower.id);
  let incomes: IncomeWithType[] = [];
  if (borrowerIds.length > 0) {
    const { data, error } = await supabase
      .from('borrower_incomes')
      .select(INCOME_SELECT)
      .in('borrower_id', borrowerIds)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) throw error;
    incomes = (data ?? []) as unknown as IncomeWithType[];
  }

  return activeBorrowers.map(({ borrower }) => {
    const own = incomes.filter((i) => i.borrower_id === borrower.id);
    return {
      borrowerId: borrower.id,
      borrowerName:
        [borrower.first_name, borrower.last_name].filter(Boolean).join(' ').trim() || '—',
      incomes: own,
      monthlyTotal: sumMonthlyIncomes(own),
    };
  });
}

export async function getIncomeById(id: IncomeId): Promise<IncomeRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('borrower_incomes')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Verify a borrower is on a given case. Used by the save/delete actions as
 * defense-in-depth: the action layer already calls userCanEditCase, but we
 * also need to make sure the borrower in the form actually belongs to this
 * case (otherwise a caller could attach incomes to someone else's borrower).
 */
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

export async function listIncomeTypeOptions(): Promise<IncomeTypeOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('income_types')
    .select('id, key, name_he, name_en')
    .eq('is_active', true)
    .order('sort_order');
  return data ?? [];
}
