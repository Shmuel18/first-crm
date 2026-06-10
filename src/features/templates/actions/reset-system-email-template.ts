'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { SYSTEM_EMAIL_TEMPLATE_KEYS } from '../domain/system-email-templates';

const ResetInput = z.object({
  key: z.enum(SYSTEM_EMAIL_TEMPLATE_KEYS),
  locale: z.enum(['he', 'en']),
});

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

export async function resetSystemEmailTemplateAction(
  key: string,
  locale: string,
): Promise<Result> {
  const parsed = ResetInput.safeParse({ key, locale });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user || !(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const { error } = await (supabase as unknown as SupabaseClient)
    .from('system_email_templates')
    .delete()
    .eq('template_key', parsed.data.key)
    .eq('locale', parsed.data.locale);
  if (error) return { ok: false, error: 'unknown' };

  revalidatePath('/settings/templates');
  return { ok: true };
}

