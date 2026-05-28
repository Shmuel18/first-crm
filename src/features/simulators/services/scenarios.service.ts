import type { Database } from '@/types/database';

import { createClient } from '@/lib/supabase/server';
import type { MortgageScenarioId, CaseId } from '@/lib/types/branded';

export type MortgageScenarioRow = Database['public']['Tables']['mortgage_scenarios']['Row'];
export type ScenarioTrackRow = Database['public']['Tables']['scenario_tracks']['Row'];
export type MortgageScenarioWithTracks = MortgageScenarioRow & { scenario_tracks: ScenarioTrackRow[] };

export const SCENARIO_FULL_COLUMNS =
  'id, case_id, primary_borrower_id, kind, title, mortgage_amount, property_value, equity, term_months, property_kind, inputs, result_snapshot, advisor_conclusion, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by' as const;

export const SCENARIO_TRACK_COLUMNS =
  'id, scenario_id, mix_label, track_type, repayment_type, amount, annual_rate_pct, term_months, cpi_annual_pct, grace_months, sort_order, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by' as const;

const SCENARIO_WITH_TRACKS = `${SCENARIO_FULL_COLUMNS}, scenario_tracks(${SCENARIO_TRACK_COLUMNS})` as const;

export async function listScenariosForCase(caseId: CaseId): Promise<MortgageScenarioWithTracks[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('mortgage_scenarios')
    .select(SCENARIO_WITH_TRACKS)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  // PostgREST cannot infer the embedded scenario_tracks relation from the
  // explicit string select; SCENARIO_WITH_TRACKS is the shape contract.
  return (data ?? []) as unknown as MortgageScenarioWithTracks[];
}

export async function listStandaloneScenarios(): Promise<MortgageScenarioWithTracks[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('mortgage_scenarios')
    .select(SCENARIO_WITH_TRACKS)
    .is('case_id', null)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  // PostgREST cannot infer the embedded scenario_tracks relation from the
  // explicit string select; SCENARIO_WITH_TRACKS is the shape contract.
  return (data ?? []) as unknown as MortgageScenarioWithTracks[];
}

export async function getScenarioById(id: MortgageScenarioId): Promise<MortgageScenarioWithTracks | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('mortgage_scenarios')
    .select(SCENARIO_WITH_TRACKS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  // PostgREST cannot infer the embedded scenario_tracks relation from the
  // explicit string select; SCENARIO_WITH_TRACKS is the shape contract.
  return data as unknown as MortgageScenarioWithTracks | null;
}
