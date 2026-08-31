'use server';

import { revalidatePath } from 'next/cache';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { SaveAgreementTemplateSchema } from '../schemas/agreement.schema';

import type { Json } from '@/types/database';

export type SaveAgreementTemplateResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

/**
 * Settings → Engagement agreement: store the office's wording for ONE language,
 * leaving the other untouched. Admin-only — this is the legal text every client
 * signs, so it is deliberately not delegated with send_client_agreement.
 *
 * Editing here never rewrites history: each send snapshots the active wording
 * onto its own row (case_agreements.text_snapshot, migration 239).
 */
export async function saveAgreementTemplateAction(
  input: unknown,
): Promise<SaveAgreementTemplateResult> {
  const parsed = SaveAgreementTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  const { data: row, error: readErr } = await supabase
    .from('office_settings')
    .select('id, agreement_text')
    .limit(1)
    .maybeSingle();
  if (readErr || !row) {
    console.error('[saveAgreementTemplate] settings read failed', readErr?.code);
    return { ok: false, error: 'unknown' };
  }

  // Merge, don't replace: saving Hebrew must not wipe the English wording.
  const current =
    row.agreement_text && typeof row.agreement_text === 'object' && !Array.isArray(row.agreement_text)
      ? (row.agreement_text as Record<string, unknown>)
      : {};
  const next = { ...current, [parsed.data.language]: parsed.data.document };

  const { error } = await supabase
    .from('office_settings')
    .update({ agreement_text: next as unknown as Json })
    .eq('id', row.id);
  if (error) {
    console.error('[saveAgreementTemplate] update failed', error.code);
    return { ok: false, error: 'unknown' };
  }

  revalidatePath('/settings/agreement');
  return { ok: true };
}
