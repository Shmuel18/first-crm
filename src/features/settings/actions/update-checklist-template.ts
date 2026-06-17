'use server';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { ChecklistTemplateFormSchema } from '../schemas/checklist-template.schema';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'not_found' | 'unknown' };

/** Update a preset checklist template (manager only). template_key/is_system are immutable. */
export async function updateChecklistTemplateAction(input: unknown): Promise<Result> {
  const parsed = ChecklistTemplateFormSchema.safeParse(input);
  if (!parsed.success || !parsed.data.id) return { ok: false, error: 'validation' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from('checklist_templates')
    .update({
      group_key: parsed.data.group_key,
      name_he: parsed.data.name_he,
      name_en: parsed.data.name_en,
      items: parsed.data.items,
      is_active: parsed.data.is_active,
      updated_by: userRes.user.id,
    })
    .eq('id', parsed.data.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[updateChecklistTemplate] update error', error.code);
    return { ok: false, error: 'unknown' };
  }
  if (!data) return { ok: false, error: 'not_found' };
  revalidatePath('/settings/checklists');
  return { ok: true };
}
