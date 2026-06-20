'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getCurrentUser, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type SetPrimaryResult = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

const InputSchema = z.object({
  scenarioId: z.uuid(),
  caseId: z.uuid(),
  isPrimary: z.boolean(),
});

export type SetPrimaryScenarioInput = z.infer<typeof InputSchema>;

/**
 * (Un)mark a case scenario as the primary mix — the one the bank-submission PDF
 * embeds. Authorization (can_edit_case) + the single-primary-per-case invariant
 * live in the SECURITY DEFINER RPC (mig 202); this action just gates on the
 * permission, validates the ids, and revalidates the case mix route.
 */
export async function setPrimaryScenarioAction(input: SetPrimaryScenarioInput): Promise<SetPrimaryResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('use_simulators'))) return { ok: false, error: 'unauthorized' };

  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('set_primary_scenario', {
    p_scenario_id: parsed.data.scenarioId,
    p_is_primary: parsed.data.isPrimary,
  });
  if (error || data !== true) {
    console.error('set_primary_scenario RPC failed', { code: error?.code });
    return { ok: false, error: 'unknown' };
  }

  revalidatePath(`/cases/${parsed.data.caseId}/simulators/mix`);
  revalidatePath(`/cases/${parsed.data.caseId}`);
  return { ok: true };
}
