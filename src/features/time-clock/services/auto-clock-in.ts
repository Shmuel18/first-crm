import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

type AutoClockProfile = {
  time_tracked: boolean;
  auto_clock_in: boolean;
  is_active: boolean;
  deleted_at: string | null;
};

type DbErrorLike = {
  code?: string;
};

function logAutoClockInFailure(stage: string, error: DbErrorLike): void {
  console.error('[time-clock] auto clock-in failed', { stage, code: error.code });
}

/**
 * Best-effort auto punch-in on login for staff who opted in
 * (profiles.auto_clock_in && profiles.time_tracked) and have no open shift.
 * Uses the caller's authenticated request client so RLS applies as the user.
 * Never throws: login must not fail because the clock hiccuped.
 *
 * `knownUserId` avoids immediately re-reading just-written auth cookies after a
 * successful sign-in or PKCE exchange.
 */
export async function autoClockInIfEnabled(
  supabase: SupabaseClient<Database>,
  knownUserId?: string | null,
): Promise<void> {
  try {
    let uid = knownUserId ?? null;
    if (!uid) {
      const { data: userRes, error: userError } = await supabase.auth.getUser();
      if (userError) {
        logAutoClockInFailure('auth', userError);
        return;
      }
      uid = userRes.user?.id ?? null;
    }
    if (!uid) return;

    const { data: prof, error: profileError } = await supabase
      .from('profiles')
      .select('time_tracked, auto_clock_in, is_active, deleted_at')
      .eq('id', uid)
      .maybeSingle();
    if (profileError) {
      logAutoClockInFailure('profile', profileError);
      return;
    }

    const profile = prof as AutoClockProfile | null;
    if (!profile?.is_active || profile.deleted_at || !profile.time_tracked || !profile.auto_clock_in) {
      return;
    }

    const { data: open, error: openError } = await supabase
      .from('time_entries')
      .select('id')
      .eq('user_id', uid)
      .is('clock_out', null)
      .is('deleted_at', null)
      .maybeSingle();
    if (openError) {
      logAutoClockInFailure('open-check', openError);
      return;
    }
    if (open) return;

    const { error: insertError } = await supabase
      .from('time_entries')
      .insert({ user_id: uid, source: 'auto', created_by: uid, updated_by: uid });
    if (insertError && insertError.code !== '23505') {
      logAutoClockInFailure('insert', insertError);
    }
  } catch (err) {
    console.error('[time-clock] auto clock-in failed', {
      stage: 'unexpected',
      message: err instanceof Error ? err.message : 'unknown',
    });
  }
}
