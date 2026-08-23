'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { BANK_PDF_SIGNATURE_MODES } from '@/features/cases/domain/bank-pdf-signature';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

const schema = z.object({ mode: z.enum(BANK_PDF_SIGNATURE_MODES) });

/**
 * Set who signs the bank summary PDF — office / advisor / nobody (migration
 * 228). Admin-only; office_settings RLS enforces the same at the DB boundary.
 * The column isn't in the generated types until they're regenerated, so an
 * untyped handle writes it (same pattern as updateUnreadStarAction).
 *
 * No revalidate: the control is optimistic and the next PDF render reads the
 * setting fresh from the DB.
 */
export async function updateBankPdfSignatureAction(mode: string): Promise<Result> {
  const parsed = schema.safeParse({ mode });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const db = supabase as unknown as SupabaseClient;
  const { data: updated, error } = await db
    .from('office_settings')
    .update({ bank_pdf_signature_mode: parsed.data.mode, updated_by: userRes.user.id })
    .eq('id', 1)
    .select('id');

  if (error) {
    console.error('[updateBankPdfSignature] update failed', { code: error.code });
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  return { ok: true };
}
