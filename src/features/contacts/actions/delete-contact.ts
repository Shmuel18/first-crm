'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'unknown' };

/** Soft delete — names already typed into cases are free text and stay. */
export async function deleteContactAction(contactId: string): Promise<Result> {
  const id = z.uuid().safeParse(contactId);
  if (!id.success) return { ok: false, error: 'unknown' };
  if (!(await userHasPermission('manage_lookups'))) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // Through the RPC: RLS hides deleted rows, so a direct UPDATE is refused.
  const { error } = await supabase.rpc('soft_delete_professional_contact', { p_id: id.data });
  if (error) {
    console.error('[deleteContact] failed', error.code);
    return { ok: false, error: 'unknown' };
  }
  revalidatePath('/settings/contacts');
  return { ok: true };
}
