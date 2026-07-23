'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getCurrentUser, isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

export async function deleteMaaserEntryAction(id: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('soft_delete_maaser_entry', { p_id: parsed.data });
  if (error || data !== true) {
    console.error('[maaser] delete entry error', { code: error?.code });
    return { ok: false, error: 'unknown' };
  }

  revalidatePath('/maaser');
  return { ok: true };
}
