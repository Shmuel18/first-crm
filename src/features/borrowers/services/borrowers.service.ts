import { createClient } from '@/lib/supabase/server';
import type { BorrowerId, CaseId } from '@/lib/types/branded';

import type { BorrowerRow, CaseBorrowerWithBorrower, RoleInCase } from '../types';

export async function listBorrowersForCase(
  caseId: CaseId,
): Promise<CaseBorrowerWithBorrower[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('case_borrowers')
    .select(`role_in_case, is_primary, borrower:borrowers(*)`)
    .eq('case_id', caseId)
    .order('is_primary', { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .filter((row): row is typeof row & { borrower: BorrowerRow } => row.borrower !== null)
    .map((row) => ({
      role_in_case: row.role_in_case as RoleInCase,
      is_primary: row.is_primary,
      borrower: row.borrower,
    }));
}

export async function getBorrowerById(id: BorrowerId): Promise<BorrowerRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('borrowers')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getCaseBorrowerLink(
  caseId: CaseId,
  borrowerId: BorrowerId,
): Promise<{ role_in_case: RoleInCase; is_primary: boolean } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('case_borrowers')
    .select('role_in_case, is_primary')
    .eq('case_id', caseId)
    .eq('borrower_id', borrowerId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { role_in_case: data.role_in_case as RoleInCase, is_primary: data.is_primary };
}
