import { DEFAULT_REGULATORY_THRESHOLDS } from '../constants';
import { RegulatoryThresholdsSchema } from '../schemas/simulator.schema';
import type { RegulatoryThresholds } from '../types';

import { createClient } from '@/lib/supabase/server';

export async function getRegulatoryThresholds(): Promise<RegulatoryThresholds> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('office_settings')
    .select('regulatory_thresholds')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error('regulatory thresholds read failed', { code: error.code });
    return DEFAULT_REGULATORY_THRESHOLDS;
  }

  const parsed = RegulatoryThresholdsSchema.safeParse(data?.regulatory_thresholds);
  return parsed.success ? parsed.data : DEFAULT_REGULATORY_THRESHOLDS;
}
