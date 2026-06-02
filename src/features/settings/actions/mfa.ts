'use server';

import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

export type MfaStatus =
  | { ok: true; enrolled: boolean; factorId: string | null }
  | { ok: false; error: 'unauthorized' | 'unknown' };

export type MfaEnrollResult =
  | { ok: true; factorId: string; qrCode: string; secret: string }
  | { ok: false; error: 'unauthorized' | 'already_enrolled' | 'unknown' };

export type MfaVerifyResult = { ok: true } | { ok: false; error: 'invalid_code' | 'unknown' };

export type MfaDisableResult = { ok: true } | { ok: false; error: 'unauthorized' | 'unknown' };

/**
 * Read the current user's MFA state. Used by the settings UI to decide
 * whether to show "Enable 2FA" or "Disable 2FA". A user can only have one
 * verified TOTP factor at a time (we enforce single-factor in the UI).
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

/**
 * Start TOTP enrollment. Returns the QR code (data: URI) and the secret
 * so the user can pair an authenticator app. The factor is created in
 * 'unverified' status — verifyMfaEnrollmentAction promotes it to verified
 * after the user proves they can read a code from the app.
 *
 * If the user already has an unverified factor from a prior incomplete
 * enrollment, we delete it first so the QR shown is the fresh one.
 */
export async function enrollMfaAction(): Promise<MfaEnrollResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // Block if already verified — UI should call disable first.
  // listFactors() only returns verified factors in @supabase/supabase-js
  // (any factor that comes back here counts as already enrolled).
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if ((factors?.totp.length ?? 0) > 0) {
    return { ok: false, error: 'already_enrolled' };
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error || !data) {
    console.error('[enrollMfa] supabase error', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }

  return {
    ok: true,
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

/**
 * Complete TOTP enrollment by verifying the 6-digit code the user typed
 * from their authenticator app. On success the factor moves to 'verified'
 * and counts as enrolled going forward.
 */
export async function verifyMfaEnrollmentAction(
  factorId: string,
  code: string,
): Promise<MfaVerifyResult> {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    return { ok: false, error: 'invalid_code' };
  }
  const supabase = await createClient();

  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
  if (chErr || !challenge) {
    console.error('[verifyMfaEnrollment] challenge error', chErr);
    return { ok: false, error: 'unknown' };
  }

  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: trimmed,
  });
  if (verifyErr) {
    // Most likely cause is a wrong code; treat as invalid_code so the UI
    // can show a focused error. Other failure modes (e.g. expired challenge)
    // would also benefit from "try again" rather than a generic error.
    return { ok: false, error: 'invalid_code' };
  }
  return { ok: true };
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
