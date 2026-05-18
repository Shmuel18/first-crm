'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

import { revokeToken } from '../services/google-oauth';
import { clearIntegration, getIntegration } from '../services/integrations.service';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'unknown'; message?: string };

export async function disconnectGoogleDriveAction(): Promise<Result> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) return { ok: false, error: 'unauthorized' };

  try {
    const row = await getIntegration('google_drive');
    // Revoking the refresh_token also invalidates all access tokens issued
    // from it - no need (and risky) to revoke the access token separately.
    if (row?.refresh_token) {
      await revokeToken(row.refresh_token).catch(() => undefined);
    }
    await clearIntegration('google_drive');
  } catch (err) {
    return {
      ok: false,
      error: 'unknown',
      message: err instanceof Error ? err.message : 'unknown',
    };
  }

  revalidatePath('/settings/integrations');
  revalidatePath('/settings');
  return { ok: true };
}
