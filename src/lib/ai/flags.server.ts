import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

import { DEFAULT_AI_FEATURES, parseAiFeatures, type AiFeatureSettings } from './flags';

/**
 * Read the office-wide AI flags. Takes the caller's client so it works from
 * server actions (user JWT — office_settings is readable by authenticated
 * users) AND from crons (admin client). Any failure fails CLOSED: no flags
 * row / query error ⇒ everything off (spec §0.1).
 */
export async function getAiFeatureSettings(
  db: SupabaseClient<Database>,
): Promise<AiFeatureSettings> {
  const { data, error } = await db
    .from('office_settings')
    .select('ai_features')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[ai] failed to read office_settings.ai_features — failing closed', error);
    return DEFAULT_AI_FEATURES;
  }
  return parseAiFeatures(data?.ai_features);
}
