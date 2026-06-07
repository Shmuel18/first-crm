import { createClient } from '@/lib/supabase/server';
import type { CaseId } from '@/lib/types/branded';

export type CaseLookupOption = { id: string; key: string; name_he: string };
export type StatusOption = { id: string; name_he: string; color: string; sort_order: number };
export type AdvisorOption = { id: string; first_name: string | null; last_name: string | null };
export type CaseFinancials = { fee_amount: number | null; expected_income: number | null };
export type ProfileName = { first_name: string | null; last_name: string | null };

export async function listCaseTypeOptions(): Promise<CaseLookupOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('case_types')
    .select('id, key, name_he')
    .eq('is_active', true)
    .order('sort_order');
  return data ?? [];
}

export async function listCaseStatusOptions(): Promise<StatusOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('case_statuses')
    .select('id, name_he, color, sort_order')
    .eq('is_active', true)
    .order('sort_order');
  return data ?? [];
}

export async function listAdvisorOptions(): Promise<AdvisorOption[]> {
  const supabase = await createClient();
  // Identity-only RPC (migration 145), NOT a direct profiles read: the
  // profiles RLS limits a non-admin to their own row, which would leave the
  // case-page advisor field unable to resolve the assigned advisor's name for
  // a secretary / senior advisor. The SECURITY DEFINER function exposes only
  // id + name (no email / phone / calendar token).
  const { data, error } = await (
    supabase as unknown as {
      rpc(
        fn: 'list_active_advisors',
      ): PromiseLike<{ data: AdvisorOption[] | null; error: { message: string } | null }>;
    }
  ).rpc('list_active_advisors');
  if (error) {
    console.error('[listAdvisorOptions] rpc failed', { message: error.message });
    return [];
  }
  return data ?? [];
}

export async function getCaseFinancials(caseId: CaseId): Promise<CaseFinancials | null> {
  const supabase = await createClient();
  // Manager-only fee / expected income (case_financials has admin RLS) — a
  // non-admin simply gets null here.
  const { data } = await supabase
    .from('case_financials')
    .select('fee_amount, expected_income')
    .eq('case_id', caseId)
    .maybeSingle();
  return data;
}

export async function getCurrentProfileName(): Promise<ProfileName | null> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', userRes.user.id)
    .single();
  return data;
}
