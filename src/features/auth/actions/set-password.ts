'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { SetPasswordSchema } from '../schemas/set-password.schema';

import type { SetPasswordState } from '../types';

/**
 * Sets the signed-in user's password. Used by the invite-callback flow:
 *   1. Admin invites → Supabase generates a single-use link.
 *   2. New user clicks link → /auth/callback exchanges code → session cookies set.
 *   3. Callback redirects here → user picks their own password.
 *
 * Also doubles as a "change password" page for any logged-in user, since
 * `auth.updateUser({ password })` is the same operation in both flows.
 */
export async function setPasswordAction(
  _prev: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const raw = {
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  };

  const parsed = SetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    // The schema's refine sets message='mismatch' on confirm. Anything else
    // (too short, missing) is a generic invalid_input that the form maps to
    // the minLength translation.
    const mismatch = parsed.error.issues.some(
      (i) => i.path[0] === 'confirm' && i.message === 'mismatch',
    );
    return { error: mismatch ? 'mismatch' : 'invalid_input' };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { error: 'unauthorized' };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: 'unknown' };

  redirect('/cases');
}
