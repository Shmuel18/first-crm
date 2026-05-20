'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

import { UpdateRoleSchema } from '../schemas/team.schema';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'unknown'; message?: string };

export async function updateMemberRoleAction(userId: string, roleId: string): Promise<Result> {
  const parsed = UpdateRoleSchema.safeParse({ userId, roleId });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase
    .from('profiles')
    .update({ role_id: parsed.data.roleId })
    .eq('id', parsed.data.userId);

  if (error) return { ok: false, error: 'unknown', message: error.message };

  revalidatePath('/team');
  return { ok: true };
}
