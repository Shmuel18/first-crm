import { createClient } from '@/lib/supabase/server';
import type { CaseId } from '@/lib/types/branded';
import { formatPersonName } from '@/lib/utils/person-name';

import { sumMonthlyIncomes } from '../domain/totals';
import type { BorrowerIncomesGroup, IncomeTypeOption, IncomeWithType } from '../types';

// Explicit column list (audit-driven). Mirrors the borrower_incomes Row
// type — when a new column is added to the schema, listing it here is what
// gates whether it flows to the client. Updating both stays a conscious
// step instead of an auto-propagation.
const INCOME_FULL_COLUMNS =
  'id, borrower_id, income_type_id, amount_monthly, source_name, tenure_months, employment_start_date, is_primary, notes, metadata, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by' as const;

const INCOME_SELECT = `
  ${INCOME_FULL_COLUMNS},
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
      .is('deleted_at', null)
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
        formatPersonName(borrower.first_name, borrower.last_name) || '—',
      incomes: own,
      monthlyTotal: sumMonthlyIncomes(own),
    };
  });
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
