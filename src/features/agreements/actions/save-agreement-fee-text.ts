'use server';

import { revalidatePath } from 'next/cache';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { SaveAgreementFeeTextSchema } from '../schemas/agreement.schema';

import type { Json } from '@/types/database';

export type SaveAgreementFeeTextResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

/**
 * Settings → Engagement agreement: store the office's fee sentences for ONE
 * language, leaving the other untouched. Admin-only, like the document wording
 * — this is the clause that states what the client pays.
 *
 * A sentence stripped of a placeholder its meaning depends on is rejected by
 * the schema, so a saved row always renders a complete clause. Editing here
 * never rewrites history: each send snapshots the wording it printed onto its
 * own row (migration 239).
 */
export async function saveAgreementFeeTextAction(
  input: unknown,
): Promise<SaveAgreementFeeTextResult> {
  const parsed = SaveAgreementFeeTextSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  const { data: row, error: readErr } = await supabase
    .from('office_settings')
    .select('id, agreement_fee_text')
    .limit(1)
    .maybeSingle();
  if (readErr || !row) {
    console.error('[saveAgreementFeeText] settings read failed', readErr?.code);
    return { ok: false, error: 'unknown' };
  }

  // Merge, don't replace: saving Hebrew must not wipe the English wording.
  const current =
    row.agreement_fee_text &&
    typeof row.agreement_fee_text === 'object' &&
    !Array.isArray(row.agreement_fee_text)
      ? (row.agreement_fee_text as Record<string, unknown>)
      : {};
  const next = { ...current, [parsed.data.language]: parsed.data.sentences };

  const { error } = await supabase
    .from('office_settings')
    .update({ agreement_fee_text: next as unknown as Json })
    .eq('id', row.id);
  if (error) {
    console.error('[saveAgreementFeeText] update failed', error.code);
    return { ok: false, error: 'unknown' };
  }

  revalidatePath('/settings/agreement');
  return { ok: true };
}
