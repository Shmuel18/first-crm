import { createClient } from '@/lib/supabase/server';

import type { CaseRow, CaseWithRelations } from '../types';

const CASE_SELECT_WITH_RELATIONS = `
  *,
  status:case_statuses(id, key, name_he, name_en, color),
  case_type_primary:case_types!cases_case_type_primary_id_fkey(id, key, name_he, name_en),
  case_type_secondary:case_types!cases_case_type_secondary_id_fkey(id, key, name_he, name_en),
  assigned_advisor:profiles!cases_assigned_advisor_id_fkey(id, first_name, last_name),
  case_borrowers(is_primary, borrower:borrowers(id, first_name, last_name, national_id)),
  case_banks(is_primary, bank:banks(id, key, name_he, color, logo_url))
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

export async function getCaseById(id: string): Promise<CaseWithRelations | null> {
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

export async function getRawCaseById(id: string): Promise<CaseRow | null> {
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

type CaseBorrowerJoin = {
  is_primary: boolean;
  borrower: {
    first_name: string | null;
    last_name: string | null;
    national_id?: string | null;
  } | null;
};

type CaseBankJoin = {
  is_primary: boolean;
  bank: {
    id: string;
    name_he: string;
    color: string;
    logo_url: string | null;
    key: string;
  } | null;
};

/**
 * Returns a short label like "ישראל ישראלי" or "ישראל ישראלי +1"
 * based on the borrowers in the case.
 */
export function getCaseClientLabel(caseItem: {
  case_borrowers?: ReadonlyArray<CaseBorrowerJoin> | null;
}): string {
  const borrowers = (caseItem.case_borrowers ?? [])
    .filter((cb) => cb.borrower !== null)
    .map((cb) => ({
      isPrimary: cb.is_primary,
      name:
        [cb.borrower!.first_name, cb.borrower!.last_name].filter(Boolean).join(' ').trim(),
    }))
    .filter((b) => b.name);

  if (borrowers.length === 0) return '';

  borrowers.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

  const primaryName = borrowers[0]!.name;
  const extra = borrowers.length - 1;

  return extra > 0 ? `${primaryName} +${extra}` : primaryName;
}

/**
 * Returns the primary borrower's national_id (Israeli ID).
 */
export function getPrimaryBorrowerNationalId(caseItem: {
  case_borrowers?: ReadonlyArray<CaseBorrowerJoin> | null;
}): string | null {
  const borrowers = (caseItem.case_borrowers ?? []).filter((cb) => cb.borrower !== null);
  if (borrowers.length === 0) return null;

  const primary = borrowers.find((cb) => cb.is_primary) ?? borrowers[0];
  return primary?.borrower?.national_id ?? null;
}

/**
 * Returns the primary bank info for the case.
 */
export function getPrimaryBank(caseItem: {
  case_banks?: ReadonlyArray<CaseBankJoin> | null;
}): {
  id: string;
  name_he: string;
  color: string;
  logo_url: string | null;
  key: string;
} | null {
  const banks = (caseItem.case_banks ?? []).filter((cb) => cb.bank !== null);
  if (banks.length === 0) return null;

  const primary = banks.find((cb) => cb.is_primary) ?? banks[0];
  return primary?.bank ?? null;
}

/**
 * Counts secondary banks (for "+N" indicator).
 */
export function getSecondaryBanksCount(caseItem: {
  case_banks?: ReadonlyArray<CaseBankJoin> | null;
}): number {
  const banks = (caseItem.case_banks ?? []).filter((cb) => cb.bank !== null);
  if (banks.length <= 1) return 0;
  return banks.length - 1;
}
