import { createClient } from '@/lib/supabase/server';
import type { CaseBankId, CaseId } from '@/lib/types/branded';

import type { CaseBankRow, CaseBankWithRelations } from '../types';

const CASE_BANK_SELECT = `
  *,
  bank:banks(id, key, name_he, color, logo_url),
  status:case_bank_statuses(id, key, name_he, color)
` as const;

export async function listCaseBanks(caseId: CaseId): Promise<CaseBankWithRelations[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('case_banks')
    .select(CASE_BANK_SELECT)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  // PostgREST embedded-relation typing gap; shape per CASE_BANK_SELECT.
  return (data ?? []) as unknown as CaseBankWithRelations[];
}

export async function getCaseBankById(id: CaseBankId): Promise<CaseBankRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('case_banks')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export type BankOption = {
  id: string;
  key: string;
  name_he: string;
  color: string;
  logo_url: string | null;
};
export type CaseBankStatusOption = { id: string; name_he: string };

export async function listBankOptions(): Promise<BankOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('banks')
    .select('id, key, name_he, color, logo_url')
    .eq('is_active', true)
    .order('sort_order');
  return data ?? [];
}

export async function listCaseBankStatusOptions(): Promise<CaseBankStatusOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('case_bank_statuses')
    .select('id, name_he')
    .eq('is_active', true)
    .order('sort_order');
  return data ?? [];
}
