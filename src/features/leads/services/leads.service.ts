import { createClient } from '@/lib/supabase/server';

import type { LeadRow } from '../types';

// Explicit column list (audit-driven). Mirrors the leads Row type so schema
// additions are gated by an intentional update here.
const LEAD_FULL_COLUMNS =
  'id, first_name, last_name, national_id, email, phone, status, assigned_to, notes, metadata, converted_at, converted_to_case_id, deleted_at, created_at, created_by, updated_at, updated_by' as const;

type LeadListOptions = {
  /**
   * Include leads that have already been converted to a case. Off by default:
   * once a lead becomes a case its workflow purpose is done, so listing it
   * next to actionable leads is noise. The row stays in the DB and is reachable
   * from its derived case — set this true to surface historical leads.
   */
  includeConverted?: boolean;
};

export async function listLeads({
  includeConverted = false,
}: LeadListOptions = {}): Promise<LeadRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from('leads')
    .select(LEAD_FULL_COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (!includeConverted) {
    query = query.neq('status', 'converted');
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function countLeads({
  includeConverted = false,
}: LeadListOptions = {}): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null);
  if (!includeConverted) {
    query = query.neq('status', 'converted');
  }
  const { count } = await query;
  return count ?? 0;
}
