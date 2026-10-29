'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import type { ContactActionState } from '../schemas/contact.schema';

import { parseContactForm } from './save-contact-shared';

export async function updateContactAction(
  _prev: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  const id = z.uuid().safeParse(formData.get('id'));
  if (!id.success) return { ok: false, error: 'unknown' };
  const parsed = await parseContactForm(formData);
  if (!parsed.ok) return parsed.state;
  if (!(await userHasPermission('manage_lookups'))) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase
    .from('professional_contacts')
    .update({ ...parsed.data, updated_by: userRes.user.id })
    .eq('id', id.data);
  if (error) {
    console.error('[updateContact] update failed', error.code);
    return { ok: false, error: 'unknown' };
  }
  revalidatePath('/settings/contacts');
  return { ok: true };
}
