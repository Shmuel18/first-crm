import { z } from 'zod';

/**
 * Validation for the JSON envelopes returned by the statistics RPCs
 * (migration 135). These schemas are the single source of truth for the
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

/**
 * One day-range bucket of the cycle-time distribution. `key` is a fixed
 * enum-ish token from the RPC (lt_30 · d30_60 · d60_90 · d90_180 · gte_180)
 * that the UI maps to a translated label — the boundaries live in SQL, the
 * wording in the message catalogs.
 */
export const CycleBucketSchema = z.object({
  key: z.string(),
  count: z.number(),
});

/** Distribution of "days from opening to ביצוע" (migration 243). Un-windowed:
 *  every case that ever reached the milestone, so the shape doesn't collapse
 *  to a handful of cases when the period selector is on a single month. */
export const CycleTimeSchema = z.object({
  n: z.number(),
  avg_days: z.number().nullable(),
  buckets: z.array(CycleBucketSchema),
});

/** Average days spent in one status, over completed stage visits. `n` counts
 *  visits, not distinct cases — a case that re-enters a stage contributes
 *  each visit (migration 243). */
export const StageBreakdownRowSchema = z.object({
  key: z.string(),
  name_he: z.string(),
  name_en: z.string(),
  color: z.string().nullable(),
  sort_order: z.number(),
  avg_days: z.number(),
  n: z.number(),
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
    /** Average days from case opening to reaching ביצוע / בוצע ושולם. Null
     *  when no case reached it in the period. */
    avg_cycle_days: z.number().nullable(),
    leads_converted_in_period: z.number(),
  }),
  /** Defaults keep the page alive against an RPC predating migration 243 —
   *  a missing key would fail the parse and blank the WHOLE dashboard, not
   *  just this panel (getStatisticsSummary returns null on parse failure). */
  cycle_time: CycleTimeSchema.nullable().default(null),
  stage_breakdown: z.array(StageBreakdownRowSchema).default([]),
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
export type CycleBucket = z.infer<typeof CycleBucketSchema>;
export type CycleTime = z.infer<typeof CycleTimeSchema>;
export type StageBreakdownRow = z.infer<typeof StageBreakdownRowSchema>;
export type StatisticsSummary = z.infer<typeof StatisticsSummarySchema>;
export type MonthlyTrendPoint = z.infer<typeof MonthlyTrendPointSchema>;
export type MonthlyTrend = z.infer<typeof MonthlyTrendSchema>;
