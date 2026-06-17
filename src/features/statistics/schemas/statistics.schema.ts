import { z } from 'zod';

/**
 * Validation for the JSON envelopes returned by the statistics RPCs
 * (migration 133). These schemas are the single source of truth for the
 * statistics data shape; the service validates RPC output against them and
 * the inferred types flow up to the UI.
 *
 * All numerics arrive as JSON numbers (Postgres numeric/int serialized into
 * jsonb). Counts are integers; money totals and the cycle-time average are
 * fractional.
 */

/** One row of the live pipeline snapshot — a status and its current count. */
export const StatusSnapshotSchema = z.object({
  key: z.string(),
  name_he: z.string(),
  name_en: z.string(),
  color: z.string().nullable(),
  sort_order: z.number(),
  count: z.number(),
});

/** Per-advisor breakdown for the selected period. */
export const AdvisorStatSchema = z.object({
  advisor_id: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  active_cases: z.number(),
  executed_in_period: z.number(),
});

export const StatisticsSummarySchema = z.object({
  period: z.object({
    from: z.string(),
    to: z.string(),
  }),
  kpis: z.object({
    active_cases: z.number(),
    opened_in_period: z.number(),
    executed_in_period: z.number(),
    stuck_cases: z.number(),
    /** Average days from case creation to entering 'execution'. Null when no
     *  case was executed in the period. */
    avg_cycle_days: z.number().nullable(),
    leads_converted_in_period: z.number(),
  }),
  status_snapshot: z.array(StatusSnapshotSchema),
  by_advisor: z.array(AdvisorStatSchema),
  financial: z.object({
    active_loan_volume: z.number(),
    /** Agreed fee summed across the active book — the forward pipeline ("what's
     *  expected to come in"). Defaults to 0 for payloads from an RPC predating
     *  migration 191. */
    active_fee_total: z.number().default(0),
    executed_fee_total: z.number(),
    /** Commissions/salaries paid out of the executed cases' fees (migration
     *  186). Net fee = executed_fee_total − this. Defaults to 0 for payloads
     *  from an RPC predating migration 187. */
    executed_payout_total: z.number().default(0),
    executed_expected_income_total: z.number(),
  }),
});

/** One month in the opened-vs-executed trend. `month` is "YYYY-MM". */
export const MonthlyTrendPointSchema = z.object({
  month: z.string(),
  opened: z.number(),
  executed: z.number(),
});

export const MonthlyTrendSchema = z.array(MonthlyTrendPointSchema);

export type StatusSnapshot = z.infer<typeof StatusSnapshotSchema>;
export type AdvisorStat = z.infer<typeof AdvisorStatSchema>;
export type StatisticsSummary = z.infer<typeof StatisticsSummarySchema>;
export type MonthlyTrendPoint = z.infer<typeof MonthlyTrendPointSchema>;
export type MonthlyTrend = z.infer<typeof MonthlyTrendSchema>;
