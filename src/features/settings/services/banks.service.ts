import { createClient } from '@/lib/supabase/server';

import type { Bank } from '../banks.constants';

const BANK_FULL_COLUMNS =
  'id, key, name_he, name_en, color, logo_url, lender_type, sort_order, is_active, is_system, created_at, updated_at' as const;

/** All lenders (active + inactive) for the admin manager, ordered for display. */
export async function listAllBanks(): Promise<Bank[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('banks')
    .select(BANK_FULL_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('name_he', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Slugify a name into a unique, stable bank key (the column is UNIQUE). */
export async function generateBankKey(nameEn: string): Promise<string> {
  const base =
    nameEn
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'lender';
  const supabase = await createClient();
  const { data } = await supabase.from('banks').select('key').like('key', `${base}%`);
  const taken = new Set((data ?? []).map((r) => r.key));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base}_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}_${Date.now()}`;
}

/** Next sort_order so new lenders land at the end of the list. */
export async function nextBankSortOrder(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('banks')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.sort_order ?? 0) + 10;
}

/** True if any case still references this lender (blocks hard delete). */
export async function bankInUse(bankId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('case_banks')
    .select('id', { count: 'exact', head: true })
    .eq('bank_id', bankId);
  return (count ?? 0) > 0;
}
