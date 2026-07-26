'use server';

import { revalidatePath } from 'next/cache';

import { revokeUserSessions } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { UpdateMemberEmailSchema } from '../schemas/team.schema';
import { sendEmailChangedEmail } from '../services/team-email';
import type { UpdateMemberEmailActionState } from '../types';

const UNIQUE_VIOLATION = '23505';

/**
 * Changes a member's login email and the public profile copy.
 *
 * profiles is updated first with a compare-and-swap condition. This serializes
 * concurrent edits for the same member. If the Auth update then fails, the
 * profile write is compensated back to the previous address so the two stores
 * do not intentionally drift.
 */
export async function updateMemberEmailAction(
  _prev: UpdateMemberEmailActionState,
  formData: FormData,
): Promise<UpdateMemberEmailActionState> {
  const values = formDataToValues(formData);
  const parsed = UpdateMemberEmailSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation',
      fieldErrors: await resolveSchemaErrors(parsed.error),
      values,
    };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  const actor = userRes.user;
  if (!actor) return { ok: false, error: 'unauthorized', values };

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) return { ok: false, error: 'unauthorized', values };

  const { user_id: userId, email } = parsed.data;
  if (userId === actor.id) return { ok: false, error: 'self_change', values };

  const rateLimitOk = await checkRateLimit({
    action: 'update_member_email',
    subject: `user:${actor.id}`,
    max: 20,
    windowSeconds: 3600,
    failMode: 'closed',
  });
  if (!rateLimitOk) return { ok: false, error: 'rate_limited', values };

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email, first_name, language')
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (profileError) {
    console.error('[updateMemberEmail] profile lookup failed', safeDbError(profileError));
    return { ok: false, error: 'unknown', values };
  }
  if (!profile?.email) return { ok: false, error: 'not_found', values };

  const oldProfileEmail = profile.email.trim().toLowerCase();
  if (oldProfileEmail === email) return { ok: false, error: 'unchanged', values };

  const admin = createAdminClient();
  const { data: authResult, error: authLookupError } =
    await admin.auth.admin.getUserById(userId);
  const oldAuthEmail = authResult.user?.email?.trim().toLowerCase() ?? null;

  if (authLookupError) {
    console.error('[updateMemberEmail] auth lookup failed', {
      code: authLookupError.code ?? null,
    });
    return { ok: false, error: 'unknown', values };
  }
  if (!oldAuthEmail) return { ok: false, error: 'not_found', values };

  // Refuse to build on top of pre-existing drift. An operator must reconcile
  // the account first; guessing which address is authoritative could lock out
  // the wrong mailbox.
  if (oldAuthEmail !== oldProfileEmail) {
    console.error('[updateMemberEmail] auth/profile email mismatch', { userId });
    return { ok: false, error: 'out_of_sync', values };
  }

  const { data: updatedProfiles, error: updateProfileError } = await supabase
    .from('profiles')
    .update({ email, updated_by: actor.id })
    .eq('id', userId)
    .eq('email', profile.email)
    .select('id');

  if (updateProfileError) {
    if (updateProfileError.code === UNIQUE_VIOLATION) {
      return { ok: false, error: 'email_exists', values };
    }
    console.error('[updateMemberEmail] profile update failed', safeDbError(updateProfileError));
    return { ok: false, error: 'unknown', values };
  }
  if (!updatedProfiles || updatedProfiles.length === 0) {
    return { ok: false, error: 'out_of_sync', values };
  }

  const { error: updateAuthError } = await admin.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
  });

  if (updateAuthError) {
    const { error: rollbackError } = await supabase
      .from('profiles')
      .update({ email: profile.email, updated_by: actor.id })
      .eq('id', userId)
      .eq('email', email);

    if (rollbackError) {
      console.error('[updateMemberEmail] profile rollback failed', safeDbError(rollbackError));
    }

    const authCode = updateAuthError.code ?? '';
    if (
      authCode === 'email_exists' ||
      authCode === 'user_already_exists' ||
      authCode === 'identity_already_exists' ||
      authCode === 'email_conflict_identity_not_deletable'
    ) {
      return { ok: false, error: 'email_exists', values };
    }
    console.error('[updateMemberEmail] auth update failed', { code: authCode || null });
    return { ok: false, error: rollbackError ? 'out_of_sync' : 'unknown', values };
  }

  const sessionResult = await revokeUserSessions(supabase, userId);
  const emailSent = await sendEmailChangedEmail({
    to: email,
    firstName: profile.first_name ?? '',
    locale: profile.language === 'en' ? 'en' : 'he',
  });

  revalidatePath('/settings/people');
  return {
    ok: true,
    email,
    emailSent,
    sessionsRevoked: sessionResult.ok,
  };
}
