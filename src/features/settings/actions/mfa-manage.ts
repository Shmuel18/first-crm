'use server';

import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

export type MfaStatus =
  | { ok: true; enrolled: boolean; factorId: string | null }
  | { ok: false; error: 'unauthorized' | 'unknown' };

export type MfaDisableResult = { ok: true } | { ok: false; error: 'unauthorized' | 'unknown' };

/**
 * Read the current user's MFA state. Used by the settings UI to decide
 * whether to show "Enable 2FA" or "Disable 2FA". A user can only have one
 * verified TOTP factor at a time (we enforce single-factor in the UI).
 *
 * Supabase scopes all mfa.* calls to the CURRENT session's user, so a foreign
 * factorId can never read/unenroll another user's factor.
 * (Split out of mfa.ts to keep each action file within the 100-line limit.)
 */
export async function getMfaStatusAction(): Promise<MfaStatus> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return { ok: false, error: 'unknown' };

  // listFactors() returns only verified factors in the public API. Treat
  // any returned TOTP factor as the enrolled one.
  const factor = data?.totp[0];
  return { ok: true, enrolled: !!factor, factorId: factor?.id ?? null };
}

/** Unenroll a verified TOTP factor. UI should confirm before calling. */
export async function disableMfaAction(factorId: string): Promise<MfaDisableResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    console.error('[disableMfa] supabase error', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }
  return { ok: true };
}
