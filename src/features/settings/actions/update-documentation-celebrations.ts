'use server';

import { z } from 'zod';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

const schema = z.boolean();

/** Update the office-wide celebration switch. Existing office_settings RLS
 * also enforces the admin-only write at the database boundary. */
export async function updateDocumentationCelebrationsAction(enabled: boolean): Promise<Result> {
  const parsed = schema.safeParse(enabled);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const { data: updated, error } = await supabase
    .from('office_settings')
    .update({
      documentation_celebrations_enabled: parsed.data,
      updated_by: userRes.user.id,
    })
    .eq('id', 1)
    .select('id');

  if (error) {
    console.error('[updateDocumentationCelebrations] update failed', { code: error.code });
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  // No revalidation: the switch is optimistic and owns its confirmed state.
  // Avoiding a route refresh keeps the control instant and prevents a jump.
  return { ok: true };
}
