import { createClient } from '@/lib/supabase/server';

import type { TeamMember, TeamRole } from '../types';

export async function listTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, first_name, last_name, email, phone, language, is_active, created_at,
      role:roles(id, key, name_he, name_en)
    `)
    .is('deleted_at', null)
    .order('is_active', { ascending: false })
    .order('first_name', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((p) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    phone: p.phone,
    language: p.language,
    is_active: p.is_active,
    created_at: p.created_at,
    role: (p.role as TeamRole | null) ?? null,
  }));
}

export async function listRoles(): Promise<TeamRole[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('roles')
    .select('id, key, name_he, name_en')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}
