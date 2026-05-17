'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { LoginSchema } from '../schemas/login.schema';
import type { LoginState } from '../types';

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  };

  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: 'invalid_input' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.message.toLowerCase().includes('invalid')) {
      return { error: 'invalid_credentials' };
    }
    return { error: 'unknown' };
  }

  redirect('/cases');
}
