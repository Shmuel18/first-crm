import { createClient } from '@/lib/supabase/server';
import type { CaseId } from '@/lib/types/branded';

import type { CaseRow, CaseWithRelations } from '../types';

const CASE_SELECT_WITH_RELATIONS = `
  *,
  status:case_statuses(id, key, name_he, name_en, color),
  case_type_primary:case_types!cases_case_type_primary_id_fkey(id, key, name_he, name_en),
  case_type_secondary:case_types!cases_case_type_secondary_id_fkey(id, key, name_he, name_en),
  assigned_advisor:profiles!cases_assigned_advisor_id_fkey(id, first_name, last_name),
  case_borrowers(is_primary, borrower:borrowers(id, first_name, last_name, national_id)),
  case_banks(is_primary, deleted_at, bank:banks(id, key, name_he, name_en, color, logo_url)),
  case_financials(fee_amount, expected_income)
` as const;

export type CaseListFilters = {
  statusId?: string;
  caseTypeId?: string;
  advisorId?: string;
  isArchived?: boolean;
  search?: string;
};

export async function listCases(filters: CaseListFilters = {}): Promise<CaseWithRelations[]> {
  const supabase = await createClient();

  let query = supabase
    .from('cases')
    .select(CASE_SELECT_WITH_RELATIONS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (filters.isArchived !== undefined) {
    query = query.eq('is_archived', filters.isArchived);
  }
  if (filters.statusId) query = query.eq('status_id', filters.statusId);
  if (filters.caseTypeId) query = query.eq('case_type_primary_id', filters.caseTypeId);
  if (filters.advisorId) query = query.eq('assigned_advisor_id', filters.advisorId);
  if (filters.search) {
    query = query.ilike('case_number', `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as CaseWithRelations[];
}

export async function getCaseById(id: CaseId): Promise<CaseWithRelations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cases')
    .select(CASE_SELECT_WITH_RELATIONS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as CaseWithRelations | null;
}

export async function getRawCaseById(id: CaseId): Promise<CaseRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Pure derivations moved to ../domain/case-derivations.ts (layer boundary).
// Re-export here for backward compatibility with any caller still importing
// from the service path - new code should import from domain directly.
export {
  getCaseClientLabel,
  getPrimaryBank,
  getPrimaryBorrowerNationalId,
  getSecondaryBanksCount,
} from '../domain/case-derivations';
