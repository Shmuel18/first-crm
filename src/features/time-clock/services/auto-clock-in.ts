import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

/**
 * Best-effort auto punch-in on login for staff who opted in (profiles
 * .auto_clock_in && .time_tracked) and have no open shift. Uses the caller's
 * already-authenticated request client so RLS applies as the user. NEVER throws
 * — login must not fail because the clock hiccuped. Called from the password
 * login action and the magic-link callback.
 */
export async function autoClockInIfEnabled(supabase: SupabaseClient<Database>): Promise<void> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return;

    const { data: prof } = await supabase
      .from('profiles')
      .select('time_tracked, auto_clock_in')
      .eq('id', uid)
      .maybeSingle();
    if (!prof?.time_tracked || !prof?.auto_clock_in) return;

    const { data: open } = await supabase
      .from('time_entries')
      .select('id')
      .eq('user_id', uid)
      .is('clock_out', null)
      .is('deleted_at', null)
      .maybeSingle();
    if (open) return;

    await supabase
      .from('time_entries')
      .insert({ user_id: uid, source: 'auto', created_by: uid, updated_by: uid });
  } catch (err) {
    console.error('[time-clock] auto clock-in failed', {
      message: err instanceof Error ? err.message : 'unknown',
    });
  }
}
