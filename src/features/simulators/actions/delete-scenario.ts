'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { getCurrentUser, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type DeleteScenarioResult = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

const ScenarioIdSchema = z.uuid();

export async function deleteScenarioAction(scenarioId: string): Promise<DeleteScenarioResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('use_simulators'))) return { ok: false, error: 'unauthorized' };

  const parsed = ScenarioIdSchema.safeParse(scenarioId);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('soft_delete_scenario', { p_scenario_id: parsed.data });
  if (error || data !== true) {
    console.error('soft_delete_scenario RPC failed', { code: error?.code });
    return { ok: false, error: 'unknown' };
  }

  revalidatePath('/simulators');
  return { ok: true };
}
