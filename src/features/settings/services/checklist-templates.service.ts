import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';

/** Full admin-manager row for a preset checklist template. */
export type ChecklistTemplateAdminRow = {
  id: string;
  template_key: string | null;
  group_key: 'identity' | 'income' | 'process';
  name_he: string;
  name_en: string;
  items: string[];
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
};

type RawRow = Omit<ChecklistTemplateAdminRow, 'items' | 'group_key'> & {
  group_key: string;
  items: unknown;
};

const COLUMNS =
  'id, template_key, group_key, name_he, name_en, items, sort_order, is_active, is_system' as const;

const asGroup = (g: string): ChecklistTemplateAdminRow['group_key'] =>
  g === 'identity' || g === 'income' ? g : 'process';

/** All preset templates (active + inactive) for the settings manager, ordered. */
export async function listChecklistTemplatesForAdmin(): Promise<ChecklistTemplateAdminRow[]> {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from('checklist_templates')
    .select(COLUMNS)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[checklist-templates admin] list error', error.code);
    return [];
  }
  return ((data ?? []) as RawRow[]).map((r) => ({
    ...r,
    group_key: asGroup(r.group_key),
    items: Array.isArray(r.items) ? r.items.filter((i): i is string => typeof i === 'string') : [],
  }));
}

/** Next sort_order so a new template lands at the end. */
export async function nextChecklistTemplateSortOrder(): Promise<number> {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const { data } = await db
    .from('checklist_templates')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as { sort_order?: number } | null)?.sort_order ?? 0) + 10;
}
