import type { SupabaseClient } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';

import {
  DEFAULT_CASE_BLOCK_PREFERENCES,
  normalizeCaseBlockPreferences,
  type CaseBlockPreferences,
} from '../domain/case-block-preferences';

// case_block_preferences (migration 103) isn't in the generated Database types,
// so it's reached through an untyped client view — same pattern as
// notification_preferences. RLS restricts every row to its owner.
function prefsTable(client: SupabaseClient) {
  return (client as unknown as SupabaseClient).from('case_block_preferences');
}

/** The current user's case-block open/closed defaults (all closed if no row). */
export async function getMyCaseBlockPreferences(): Promise<CaseBlockPreferences> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return DEFAULT_CASE_BLOCK_PREFERENCES;

  const { data } = await prefsTable(supabase)
    .select('prefs')
    .eq('user_id', userRes.user.id)
    .maybeSingle();

  return normalizeCaseBlockPreferences((data as { prefs?: unknown } | null)?.prefs);
}

/** Upsert the current user's case-block preferences. */
export async function updateMyCaseBlockPreferences(
  prefs: CaseBlockPreferences,
): Promise<boolean> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return false;

  const { error } = await prefsTable(supabase)
    .upsert({ user_id: userRes.user.id, prefs }, { onConflict: 'user_id' })
    .select('user_id');
  return !error;
}
