'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import {
  CHECKLIST_TEMPLATE_KEYS,
  getChecklistTemplate,
} from '../domain/checklist-templates';

const AddChecklistTemplateSchema = z.object({
  caseId: z.string().min(1).max(100),
  templateKey: z.enum(CHECKLIST_TEMPLATE_KEYS),
});

type Result =
  | { ok: true; added: number }
  | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

/**
 * Append all items of a preset office checklist (Kaufman's work-lists, see
 * domain/checklist-templates.ts) to a case's checklist. Items whose label
 * already exists on the case are skipped, so re-picking a template — or two
 * templates sharing an item — never duplicates rows. Inserts go one-by-one
 * through the existing add_case_checklist_item RPC (SECURITY DEFINER, the
 * table's only write path) sequentially, keeping sort_order contiguous.
 */
export async function addChecklistTemplateAction(input: unknown): Promise<Result> {
  const parsed = AddChecklistTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  const { caseId, templateKey } = parsed.data;

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  // Existing labels for dedup — SELECT is open to case viewers via RLS.
  const { data: existingRows, error: readErr } = await supabase
    .from('case_checklist_items')
    .select('label')
    .eq('case_id', caseId);
  if (readErr) {
    console.error('[addChecklistTemplate] read failed', { caseId, code: readErr.code });
    return { ok: false, error: 'unknown' };
  }
  const existing = new Set(
    (existingRows ?? [])
      .map((r) => r.label?.trim())
      .filter((l): l is string => !!l),
  );

  const template = getChecklistTemplate(templateKey);
  const toAdd = template.items.filter((label) => !existing.has(label.trim()));

  for (const label of toAdd) {
    const { error } = await supabase.rpc('add_case_checklist_item', {
      p_case_id: caseId,
      p_label: label,
    });
    if (error) {
      console.error('[addChecklistTemplate] rpc failed', {
        caseId,
        templateKey,
        code: error.code,
      });
      // Items inserted so far stay (each is valid on its own); report failure.
      return { ok: false, error: 'unknown' };
    }
  }

  revalidatePath(`/cases/${caseId}/documents`);
  return { ok: true, added: toAdd.length };
}
