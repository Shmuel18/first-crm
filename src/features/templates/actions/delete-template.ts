'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { deleteMessageTemplate } from '../services/templates.service';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

export async function deleteTemplateAction(templateId: string): Promise<Result> {
  if (!z.uuid().safeParse(templateId).success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const ok = await deleteMessageTemplate(templateId, userRes.user.id);
  if (!ok) return { ok: false, error: 'unknown' };

  revalidatePath('/templates');
  return { ok: true };
}
