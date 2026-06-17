'use server';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { ChecklistTemplateFormSchema } from '../schemas/checklist-template.schema';
import { nextChecklistTemplateSortOrder } from '../services/checklist-templates.service';

type Result = { ok: true; id: string } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

/** Slugify a name into a stable, unique template_key. */
function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'template'
  );
}

/** Create a preset checklist template (manager only). */
export async function createChecklistTemplateAction(input: unknown): Promise<Result> {
  const parsed = ChecklistTemplateFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const db = supabase as unknown as SupabaseClient;
  const sortOrder = await nextChecklistTemplateSortOrder();
  const base = slugify(parsed.data.name_en || parsed.data.name_he);

  const insert = (key: string) =>
    db
      .from('checklist_templates')
      .insert({
        template_key: key,
        group_key: parsed.data.group_key,
        name_he: parsed.data.name_he,
        name_en: parsed.data.name_en,
        items: parsed.data.items,
        is_active: parsed.data.is_active,
        is_system: false,
        sort_order: sortOrder,
        created_by: userRes.user.id,
        updated_by: userRes.user.id,
      })
      .select('id')
      .single();

  let { data, error } = await insert(base);
  if (error?.code === '23505') ({ data, error } = await insert(`${base}_${sortOrder}`));

  if (error || !data) {
    console.error('[createChecklistTemplate] insert error', error?.code);
    return { ok: false, error: 'unknown' };
  }
  revalidatePath('/settings/checklists');
  return { ok: true, id: (data as { id: string }).id };
}
