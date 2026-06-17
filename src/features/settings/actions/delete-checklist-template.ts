'use server';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'system_locked' | 'unknown' };

/**
 * Delete a preset checklist template (manager only). System seed templates are
 * never deletable — the manager deactivates them instead so the picker hides
 * them without losing the office's canonical work-lists.
 */
export async function deleteChecklistTemplateAction(id: string): Promise<Result> {
  if (typeof id !== 'string' || id.length === 0) return { ok: false, error: 'validation' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;

  const { data: row } = await db
    .from('checklist_templates')
    .select('is_system')
    .eq('id', id)
    .maybeSingle();
  if ((row as { is_system?: boolean } | null)?.is_system) {
    return { ok: false, error: 'system_locked' };
  }

  const { error } = await db.from('checklist_templates').delete().eq('id', id);
  if (error) {
    console.error('[deleteChecklistTemplate] delete error', error.code);
    return { ok: false, error: 'unknown' };
  }
  revalidatePath('/settings/checklists');
  return { ok: true };
}
