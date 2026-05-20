import { createClient } from '@/lib/supabase/server';

import type { TeamMember, TeamRole } from '../types';

export async function listTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createClient();

  const [profilesRes, casesRes, tasksRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(`
        id, first_name, last_name, email, phone, language, is_active, created_at,
        role:roles(id, key, name_he, name_en)
      `)
      .order('is_active', { ascending: false })
      .order('first_name', { ascending: true }),
    supabase
      .from('cases')
      .select('assigned_advisor_id')
      .is('deleted_at', null)
      .eq('is_archived', false),
    supabase
      .from('tasks')
      .select('assigned_to')
      .eq('status', 'pending')
      .is('deleted_at', null),
  ]);

  if (profilesRes.error) throw profilesRes.error;

  const caseCounts = tally((casesRes.data ?? []).map((r) => r.assigned_advisor_id));
  const taskCounts = tally((tasksRes.data ?? []).map((r) => r.assigned_to));

  return (profilesRes.data ?? []).map((p) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    phone: p.phone,
    language: p.language,
    is_active: p.is_active,
    created_at: p.created_at,
    role: (p.role as TeamRole | null) ?? null,
    activeCasesCount: caseCounts.get(p.id) ?? 0,
    openTasksCount: taskCounts.get(p.id) ?? 0,
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

function tally(ids: Array<string | null>): Map<string, number> {
  const map = new Map<string, number>();
  for (const id of ids) {
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}
