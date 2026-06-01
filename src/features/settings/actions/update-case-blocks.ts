'use server';

import { revalidatePath } from 'next/cache';

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

  // The case pages read these on their own render, so only the settings page
  // needs revalidating; the new defaults apply on the next case-page load.
  revalidatePath('/settings/display');
  return { ok: true };
}
