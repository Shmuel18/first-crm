import { getAdvisorContact } from '@/features/cases/services/advisor-contact.service';
import { getCaseById } from '@/features/cases/services/cases.service';
import { asCaseId, type MortgageScenarioId } from '@/lib/types/branded';

import { aggregateMix } from '../domain/mix-aggregate';
import { MixInputSchema, PropertyKindSchema, ScenarioKindSchema } from '../schemas/simulator.schema';
import { getScenarioById } from '../services/scenarios.service';
import type { MixResult, PropertyKind, RepaymentType, ScenarioKind, TrackType } from '../types';

/**
 * Assembles the typed shape consumed by <ReportDocument />. The saved `inputs`
 * (a validated MixInput) are the source of truth — we re-run aggregateMix on
 * the server rather than trusting the stored result_snapshot (see plan risk
 * #5). This file is a fetch→DTO mapper; all math stays in the pure engine.
 */
export type ReportTrack = {
  type: TrackType;
  repayment: RepaymentType;
  amount: number;
  annualRatePct: number;
  termMonths: number;
  cpiAnnualPct: number | null;
};

export type ScenarioReportData = {
  meta: { title: string; kind: ScenarioKind; createdAt: string; advisorConclusion: string | null };
  caseInfo: { caseNumber: string; advisorName: string | null } | null;
  loan: {
    mortgageAmount: number;
    propertyValue: number;
    equity: number;
    termMonths: number;
    propertyKind: PropertyKind;
  };
  tracks: ReadonlyArray<ReportTrack>;
  result: MixResult;
};

export async function loadScenarioReport(id: MortgageScenarioId): Promise<ScenarioReportData | null> {
  const scenario = await getScenarioById(id);
  if (!scenario) return null;

  const parsedInputs = MixInputSchema.safeParse(scenario.inputs);
  if (!parsedInputs.success) return null;
  const mix = parsedInputs.data;
  const result = aggregateMix(mix);

  const caseInfo = scenario.case_id ? await loadCaseInfo(scenario.case_id) : null;

  return {
    meta: {
      title: scenario.title,
      kind: ScenarioKindSchema.catch('mix').parse(scenario.kind),
      createdAt: scenario.created_at,
      advisorConclusion: scenario.advisor_conclusion,
    },
    caseInfo,
    loan: {
      mortgageAmount: mix.mortgageAmount,
      propertyValue: mix.propertyValue,
      equity: mix.equity,
      termMonths: mix.defaultTermMonths,
      propertyKind: PropertyKindSchema.catch('first_home').parse(scenario.property_kind),
    },
    tracks: mix.tracks.map((track) => ({
      type: track.type,
      repayment: track.repayment,
      amount: track.amount,
      annualRatePct: track.annualRatePct,
      termMonths: track.termMonths,
      cpiAnnualPct: track.cpiAnnualPct,
    })),
    result,
  };
}

async function loadCaseInfo(caseId: string): Promise<{ caseNumber: string; advisorName: string | null } | null> {
  const caseData = await getCaseById(asCaseId(caseId));
  if (!caseData) return null;
  // Admin-client resolve — the cases→profiles embed is NULL for a non-admin here.
  const advisor = await getAdvisorContact(caseData.assigned_advisor_id);
  return { caseNumber: caseData.case_number, advisorName: advisor.name };
}
