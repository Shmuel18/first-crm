import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';

import type { ChecklistTemplateGroup } from '../domain/checklist-templates';

/** Picker option (no items — the add action looks the items up server-side). */
export type ChecklistTemplateOption = {
  key: string;
  group: ChecklistTemplateGroup;
  nameHe: string;
  nameEn: string;
};

type TemplateRow = {
  template_key: string | null;
  group_key: string;
  name_he: string;
  name_en: string;
  items: unknown;
};

const VALID_GROUP = new Set<ChecklistTemplateGroup>(['identity', 'income', 'process']);
const asGroup = (g: string): ChecklistTemplateGroup =>
  VALID_GROUP.has(g as ChecklistTemplateGroup) ? (g as ChecklistTemplateGroup) : 'process';

/**
 * Active preset checklist templates for the picker, ordered for display.
 * Reads checklist_templates (migration 189) — staff-readable via RLS. The table
 * is the single source of truth now; the in-code constant is only the seed.
 */
export async function listActiveChecklistTemplates(): Promise<ChecklistTemplateOption[]> {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from('checklist_templates')
    .select('template_key, group_key, name_he, name_en')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[checklist-templates] list error', error.code);
    return [];
  }
  return ((data ?? []) as TemplateRow[])
    .filter((r) => !!r.template_key)
    .map((r) => ({
      key: r.template_key as string,
      group: asGroup(r.group_key),
      nameHe: r.name_he,
      nameEn: r.name_en,
    }));
}

/**
 * Item labels for one template, by key — used by addChecklistTemplateAction to
 * materialize the rows onto a case. Null when the template is gone/inactive.
 */
export async function getChecklistTemplateItems(templateKey: string): Promise<string[] | null> {
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from('checklist_templates')
    .select('items')
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;
  const items = (data as { items: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items.filter((i): i is string => typeof i === 'string' && i.trim().length > 0);
}
