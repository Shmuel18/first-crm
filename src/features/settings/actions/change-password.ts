'use server';

import { createClient } from '@/lib/supabase/server';
import { formDataToObject } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { ChangePasswordSchema } from '../schemas/security.schema';
import type { SettingsActionState } from '../types';

export async function changePasswordAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  // Never round-trip password values back to the client.
  const parsed = ChangePasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: 'unknown' };

  // SEC (R3-settings-1, mirrors set-password.ts / R1-auth-2): a password
  // change is the canonical "evict whoever else holds my account" action —
  // kill every OTHER session so a stolen or stale session does not survive.
  // Best-effort: a revoke hiccup must not fail the change that succeeded.
  const { error: revokeErr } = await supabase.auth.signOut({ scope: 'others' });
  if (revokeErr) {
    console.error('[changePassword] revoking other sessions failed', {
      code: revokeErr.code ?? null,
    });
  }

  return { ok: true };
}
