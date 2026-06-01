import { z } from 'zod';

import { MAX_TRACKS } from '../constants';

export const TrackTypeSchema = z.enum([
  'fixed_unlinked',
  'fixed_linked',
  'prime',
  'variable_unlinked',
  'variable_linked',
  'eligibility',
]);

export const RepaymentTypeSchema = z.enum(['spitzer', 'equal_principal', 'balloon']);
export const ScenarioKindSchema = z.enum([
  'mix',
  'comparison',
  'scenario',
  'capacity',
  'early_repayment',
  'refinance',
]);
export const SimulatorKindSchema = z.enum([
  ...ScenarioKindSchema.options,
  'max_mortgage',
  'dti',
  'ltv',
  'monthly_payment',
  'prime_impact',
  'cpi_impact',
  'fixed_variable_compare',
  'repayment_type_compare',
  'balloon_bullet',
  'purchase_tax',
  'closing_costs',
  'guarantor_impact',
  'bank_offer_comparison',
  'best_bank_fit',
  'approval_probability',
  'rent_vs_buy',
  'client_report',
]);
export const PropertyKindSchema = z.enum(['first_home', 'replacement', 'investment']);

const moneyAgorot = z.coerce
  .number({ error: 'simulators.errors.invalidAmount' })
  .int({ error: 'simulators.errors.invalidAmount' })
  .min(0, { error: 'simulators.errors.invalidAmount' });

const pct = z.coerce
  .number({ error: 'simulators.errors.invalidPercent' })
  .min(-20, { error: 'simulators.errors.invalidPercent' })
  .max(100, { error: 'simulators.errors.invalidPercent' });

export const ScenarioTrackSchema = z
  .object({
    id: z.string().min(1),
    type: TrackTypeSchema,
    amount: moneyAgorot.min(1, { error: 'simulators.errors.amountRequired' }),
    annualRatePct: pct,
    termMonths: z.coerce.number().int().min(1).max(480),
    repayment: RepaymentTypeSchema,
    cpiAnnualPct: pct.nullable(),
    graceMonths: z.coerce.number().int().min(0).max(480).nullable(),
  })
  .superRefine((track, ctx) => {
    if (!track.type.endsWith('_linked') && track.cpiAnnualPct !== null) {
      ctx.addIssue({ code: 'custom', path: ['cpiAnnualPct'], message: 'simulators.errors.cpiOnlyLinked' });
    }
    if (track.repayment !== 'balloon' && track.graceMonths !== null) {
      ctx.addIssue({ code: 'custom', path: ['graceMonths'], message: 'simulators.errors.graceOnlyBalloon' });
    }
  });

export const MixInputSchema = z.object({
  mortgageAmount: moneyAgorot.min(1, { error: 'simulators.errors.amountRequired' }),
  propertyValue: moneyAgorot.min(1, { error: 'simulators.errors.amountRequired' }),
  equity: moneyAgorot,
  defaultTermMonths: z.coerce.number().int().min(1).max(480),
  tracks: z.array(ScenarioTrackSchema).min(1).max(MAX_TRACKS),
});

export const RegulatoryThresholdsSchema = z.object({
  maxLtvPct: z.object({
    first_home: z.coerce.number().min(1).max(100),
    replacement: z.coerce.number().min(1).max(100),
    investment: z.coerce.number().min(1).max(100),
  }),
  minFixedPct: z.coerce.number().min(0).max(100),
  maxPrimePct: z.coerce.number().min(0).max(100),
  maxEqualPrincipalPct: z.coerce.number().min(0).max(100),
  maxTermMonths: z.coerce.number().int().min(1).max(480),
});

export const SaveScenarioSchema = z.object({
  // Present → edit that scenario in place; absent/null → create a new one.
  scenarioId: z.uuid().nullish(),
  caseId: z.uuid().nullable(),
  primaryBorrowerId: z.uuid().nullable(),
  kind: ScenarioKindSchema,
  title: z.string().trim().min(1).max(120),
  propertyKind: PropertyKindSchema,
  mix: MixInputSchema,
  advisorConclusion: z.string().trim().max(4000).nullable(),
});

export const StressScenarioSchema = z.object({
  primeDeltaPct: z.coerce.number().min(-10).max(20),
  variableDeltaPct: z.coerce.number().min(-10).max(20),
  cpiAnnualPct: z.coerce.number().min(-5).max(30),
  changeMonth: z.coerce.number().int().min(1).max(360),
  paymentThreshold: moneyAgorot.nullable(),
});

export type ScenarioTrackInput = z.infer<typeof ScenarioTrackSchema>;
export type MixInputForm = z.infer<typeof MixInputSchema>;
export type SaveScenarioInput = z.infer<typeof SaveScenarioSchema>;
export type RegulatoryThresholdsInput = z.infer<typeof RegulatoryThresholdsSchema>;
export type StressScenarioInput = z.infer<typeof StressScenarioSchema>;
export type SimulatorKindInput = z.infer<typeof SimulatorKindSchema>;

