import { createClient } from '@/lib/supabase/server';

import type { CaseBankRow, CaseBankWithRelations } from '../types';

const CASE_BANK_SELECT = `
  *,
  bank:banks(id, key, name_he, color, logo_url),
  status:case_bank_statuses(id, key, name_he, color)
` as const;

export async function listCaseBanks(caseId: string): Promise<CaseBankWithRelations[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('case_banks')
    .select(CASE_BANK_SELECT)
    .eq('case_id', caseId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as CaseBankWithRelations[];
}

export async function getCaseBankById(id: string): Promise<CaseBankRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('case_banks')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}
