'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { AddMaaserEntrySchema, type AddMaaserEntryInput } from '../schemas/maaser.schema';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

export async function addMaaserEntryAction(input: AddMaaserEntryInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const parsed = AddMaaserEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { error } = await supabase.from('maaser_ledger_entries').insert({
    entry_date: parsed.data.entryDate,
    kind: parsed.data.kind,
    amount: parsed.data.amount,
    description: parsed.data.description?.trim() || null,
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) {
    console.error('[maaser] add entry error', { code: error.code });
    return { ok: false, error: 'unknown' };
  }

  revalidatePath('/maaser');
  return { ok: true };
}
