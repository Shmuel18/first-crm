'use server';

import {
  CASE_BLOCK_KEYS,
  type CaseBlockPreferences,
} from '@/features/cases/domain/case-block-preferences';
import { updateMyCaseBlockPreferences } from '@/features/cases/services/case-block-preferences.service';
import { createClient } from '@/lib/supabase/server';

import type { SettingsActionState } from '../types';

/**
 * Saves the current user's case-block open/closed defaults. Checkboxes submit
 * as present-when-checked / absent-when-unchecked, so `formData.has` reads the
 * toggle state directly. Own-row only — the service writes against the
 * caller's user_id (RLS enforces it too).
 */
export async function updateCaseBlocksAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const prefs = {} as CaseBlockPreferences;
  for (const key of CASE_BLOCK_KEYS) {
    prefs[key] = formData.has(`block_${key}`);
  }

  const ok = await updateMyCaseBlockPreferences(prefs);
  if (!ok) return { ok: false, error: 'unknown' };

  // No revalidatePath here. The toggles are uncontrolled (the DOM already
  // reflects the user's choice after saving) and case pages read these prefs
  // fresh on their own render — so nothing on screen needs re-rendering.
  // Revalidating forced the action's response to wait on a full RSC re-render
  // round-trip, which kept the Submit button's `pending` state stuck (the same
  // spinner-hang seen with add-bank). The success toast confirms the save.
  return { ok: true };
}
