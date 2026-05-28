'use server';

import { revalidatePath } from 'next/cache';

import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, userHasPermission } from '@/lib/auth/permissions';
import type { Json } from '@/types/database';

import { aggregateMix } from '../domain/mix-aggregate';
import { validateMix } from '../domain/regulatory-rules';
import { SaveScenarioSchema, type SaveScenarioInput } from '../schemas/simulator.schema';
import { getRegulatoryThresholds } from '../services/settings.service';
import type { RegulatoryViolation } from '../types';

type SaveScenarioResult =
  | { ok: true; scenarioId: string }
  | { ok: false; error: 'unauthorized' | 'validation' | 'rate_limited' | 'regulatory' | 'unknown'; violations?: ReadonlyArray<RegulatoryViolation> };

export async function saveScenarioAction(input: SaveScenarioInput): Promise<SaveScenarioResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('use_simulators'))) return { ok: false, error: 'unauthorized' };

  const allowed = await checkRateLimit({
    action: 'save_mortgage_scenario',
    subject: `user:${user.id}`,
    max: 60,
    windowSeconds: 3600,
    failMode: 'closed',
  });
  if (!allowed) return { ok: false, error: 'rate_limited' };

  const parsed = SaveScenarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const thresholds = await getRegulatoryThresholds();
  const violations = validateMix(parsed.data.mix, thresholds, parsed.data.propertyKind);
  if (violations.length > 0) return { ok: false, error: 'regulatory', violations };

  const resultSnapshot = aggregateMix(parsed.data.mix);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('save_mortgage_scenario', {
    p_payload: buildSavePayload(parsed.data, resultSnapshot),
  });

  if (error || !data) {
    console.error('save_mortgage_scenario RPC failed', { code: error?.code });
    return { ok: false, error: 'unknown' };
  }

  revalidatePath('/simulators');
  if (parsed.data.caseId) {
    revalidatePath(`/cases/${parsed.data.caseId}`);
    revalidatePath(`/cases/${parsed.data.caseId}/simulators`);
  }
  return { ok: true, scenarioId: data };
}

function buildSavePayload(input: SaveScenarioInput, resultSnapshot: unknown): Json {
  return {
    caseId: input.caseId,
    primaryBorrowerId: input.primaryBorrowerId,
    kind: input.kind,
    title: input.title,
    mortgageAmount: input.mix.mortgageAmount,
    propertyValue: input.mix.propertyValue,
    equity: input.mix.equity,
    termMonths: input.mix.defaultTermMonths,
    propertyKind: input.propertyKind,
    inputs: input.mix as unknown as Json,
    resultSnapshot: resultSnapshot as Json,
    advisorConclusion: input.advisorConclusion,
    tracks: input.mix.tracks.map((track, index) => ({
      mixLabel: 'A',
      trackType: track.type,
      repaymentType: track.repayment,
      amount: track.amount,
      annualRatePct: track.annualRatePct,
      termMonths: track.termMonths,
      cpiAnnualPct: track.cpiAnnualPct,
      graceMonths: track.graceMonths,
      sortOrder: index,
    })),
  };
}
