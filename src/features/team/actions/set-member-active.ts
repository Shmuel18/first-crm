'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

import { SetActiveSchema } from '../schemas/team.schema';

type Result =
  | { ok: true }
  | {
      ok: false;
      error: 'unauthorized' | 'validation' | 'self_deactivate' | 'unknown';
      message?: string;
    };

export async function setMemberActiveAction(userId: string, isActive: boolean): Promise<Result> {
  const parsed = SetActiveSchema.safeParse({ userId, isActive });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) return { ok: false, error: 'unauthorized' };

  // Guard against an admin locking themselves out.
  if (!parsed.data.isActive && parsed.data.userId === userRes.user.id) {
    return { ok: false, error: 'self_deactivate' };
  }

  // .select() confirms a row changed; 0 rows means RLS (manage_users) blocked
  // the write, which we surface rather than reporting a false success.
  const { data: updated, error } = await supabase
    .from('profiles')
    .update({ is_active: parsed.data.isActive })
    .eq('id', parsed.data.userId)
    .select('id');

  if (error) return { ok: false, error: 'unknown', message: error.message };
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  revalidatePath('/team');
  return { ok: true };
}
