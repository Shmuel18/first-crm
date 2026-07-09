import { createClient } from '@/lib/supabase/server';
import type { CaseId } from '@/lib/types/branded';

import type { CaseRow, CaseWithRelations } from '../types';

// Explicit column list (audit-driven). Mirrors the cases Row type — schema
// additions go through an intentional update here rather than auto-flowing
// to clients. Excludes embedded relations; CASE_SELECT_WITH_RELATIONS below
// is the "with relations" variant.
const CASE_FULL_COLUMNS =
  'id, case_number, status_id, assigned_advisor_id, primary_borrower_id, case_type_primary_id, case_type_secondary_id, case_type_other_text, property_value, equity, requested_mortgage_amount, request_details, short_note, referrer_name, city, gush_helka, case_blocker, insurance_status, insurance_agent_name, appraiser_name, target_date, is_archived, metadata, version, deleted_at, created_at, created_by, updated_at, updated_by' as const;

const CASE_SELECT_WITH_RELATIONS = `
  ${CASE_FULL_COLUMNS},
  status:case_statuses(id, key, name_he, name_en, color),
  case_type_primary:case_types!cases_case_type_primary_id_fkey(id, key, name_he, name_en),
  case_type_secondary:case_types!cases_case_type_secondary_id_fkey(id, key, name_he, name_en),
  assigned_advisor:profiles!cases_assigned_advisor_id_fkey(id, first_name, last_name, phone, email),
  case_associated_advisors(advisor_id),
  case_borrowers(is_primary, borrower:borrowers(id, first_name, last_name, national_id, phone, landline_phone)),
  case_banks(id, is_primary, deleted_at, banker_name, bank:banks(id, key, name_he, name_en, color, logo_url)),
  case_financials(fee_amount, expected_income, fee_paid, fee_paid_at)
` as const;

export type CaseListFilters = {
  statusId?: string;
  caseTypeId?: string;
  advisorId?: string;
  isArchived?: boolean;
  search?: string;
  /** Safety bound on rows returned (newest first). Unset = unbounded (exports). */
  limit?: number;
};

export async function listCases(filters: CaseListFilters = {}): Promise<CaseWithRelations[]> {
  const supabase = await createClient();

  // Default ordering: oldest first. The dashboard treats the # column as a
  // timeline counter, so case #1 is the oldest open case (typical mortgage-
  // pipeline reading: top of list = "next to push along"). The table allows
  // opt-in column sorting on top of this; cancelling that sort returns to
  // this default.
  let query = supabase
    .from('cases')
    .select(CASE_SELECT_WITH_RELATIONS)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (filters.isArchived !== undefined) {
    query = query.eq('is_archived', filters.isArchived);
  }
  if (filters.statusId) query = query.eq('status_id', filters.statusId);
  if (filters.caseTypeId) query = query.eq('case_type_primary_id', filters.caseTypeId);
  if (filters.advisorId) query = query.eq('assigned_advisor_id', filters.advisorId);
  if (filters.search) {
    // Escape LIKE wildcards so a user's % / _ / \ can't broaden the match.
    const term = filters.search.replace(/[\\%_]/g, (c) => `\\${c}`);
    query = query.ilike('case_number', `%${term}%`);
  }
  if (filters.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) throw error;
  // PostgREST can't type the embedded-relation select; CASE_SELECT_WITH_RELATIONS
  // above is the shape contract.
  return (data ?? []) as unknown as CaseWithRelations[];
}

export type CaseViewCounts = { active: number; archived: number };

export async function getCaseViewCounts(): Promise<CaseViewCounts> {
  const supabase = await createClient();
  const countArchived = (isArchived: boolean) =>
    supabase
      .from('cases')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('is_archived', isArchived);

  const [active, archived] = await Promise.all([countArchived(false), countArchived(true)]);
  return { active: active.count ?? 0, archived: archived.count ?? 0 };
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
  // PostgREST embedded-relation typing gap; shape per CASE_SELECT_WITH_RELATIONS.
  return data as unknown as CaseWithRelations | null;
}

export async function getRawCaseById(id: CaseId): Promise<CaseRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cases')
    .select(CASE_FULL_COLUMNS)
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
