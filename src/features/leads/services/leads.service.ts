import { createClient } from '@/lib/supabase/server';

import type { LeadRow } from '../types';

export async function listLeads(): Promise<LeadRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function countLeads(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null);
  return count ?? 0;
}
