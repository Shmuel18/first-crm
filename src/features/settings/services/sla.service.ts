import { createClient } from '@/lib/supabase/server';

import {
  SLA_STATUS_KEYS,
  type SlaStatusKey,
  type SlaThresholds,
} from '../schemas/sla.schema';

export type SlaStatusRow = {
  key: SlaStatusKey;
  name_he: string;
  name_en: string;
  sort_order: number;
  is_terminal: boolean;
};

const KNOWN_KEYS = new Set<string>(SLA_STATUS_KEYS);

/**
 * Returns active case statuses in sort order. Used by the SLA settings page
 * to render one input per status (manager-only).
 */
export async function listSlaStatuses(): Promise<SlaStatusRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('case_statuses')
    .select('key, name_he, name_en, sort_order, is_terminal')
    .eq('is_active', true)
    .order('sort_order');
  if (error || !data) return [];
  // Defensive: drop any status whose key isn't in our compile-time enum
  // (would only happen if someone added a row without updating SLA_STATUS_KEYS).
  return data.filter((r): r is SlaStatusRow => KNOWN_KEYS.has(r.key));
}

/** Reads the current per-office SLA thresholds (singleton row id=1). */
export async function getSlaThresholds(): Promise<SlaThresholds> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('office_settings')
    .select('sla_status_thresholds')
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) return {};
  return sanitizeThresholds(data.sla_status_thresholds);
}

/** Strip unknown keys / non-positive-int values from a JSONB blob. */
export function sanitizeThresholds(raw: unknown): SlaThresholds {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: SlaThresholds = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!KNOWN_KEYS.has(k)) continue;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 1 || v > 365) continue;
    out[k as SlaStatusKey] = Math.floor(v);
  }
  return out;
}
