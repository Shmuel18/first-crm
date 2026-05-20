'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/** Revokes every active session for the current user, then sends to login. */
export async function signOutEverywhereAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'global' });
  redirect('/login');
}
