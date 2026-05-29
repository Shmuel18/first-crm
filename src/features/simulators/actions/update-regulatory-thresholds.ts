'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUser, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import {
  RegulatoryThresholdsSchema,
  type RegulatoryThresholdsInput,
} from '../schemas/simulator.schema';

type UpdateThresholdsResult = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

export async function updateRegulatoryThresholdsAction(
  input: RegulatoryThresholdsInput,
): Promise<UpdateThresholdsResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('manage_simulator_settings'))) {
    return { ok: false, error: 'unauthorized' };
  }

  const parsed = RegulatoryThresholdsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('save_regulatory_thresholds', {
    p_thresholds: parsed.data,
  });
  if (error) {
    console.error('save_regulatory_thresholds RPC failed', { code: error.code });
    return { ok: false, error: 'unknown' };
  }

  revalidatePath('/settings/simulators');
  revalidatePath('/simulators');
  return { ok: true };
}
