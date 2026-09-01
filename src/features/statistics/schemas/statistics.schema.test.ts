import { describe, expect, it } from 'vitest';

import { StatisticsSummarySchema } from './statistics.schema';

/**
 * The dashboard renders nothing at all when this parse fails —
 * getStatisticsSummary returns null on a failed safeParse and StatisticsView
 * falls back to the empty state for the WHOLE page, not just the offending
 * panel. So the contract with the RPC is worth pinning down, especially the
 * defaults that let new code run against an older database during a rollout.
 */

/** Shape-accurate payload from get_statistics_summary (migration 243). */
function payload(): Record<string, unknown> {
  return {
    period: { from: '2026-01-01T00:00:00+02:00', to: '2027-01-01T00:00:00+02:00' },
    kpis: {
      active_cases: 60,
      opened_in_period: 69,
      executed_in_period: 15,
      stuck_cases: 3,
      avg_cycle_days: 26.6,
      leads_converted_in_period: 2,
    },
    cycle_time: {
      n: 15,
      avg_days: 26.6,
      buckets: [
        { key: 'lt_30', count: 11 },
        { key: 'd30_60', count: 0 },
        { key: 'd60_90', count: 4 },
        { key: 'd90_180', count: 0 },
        { key: 'gte_180', count: 0 },
      ],
    },
    stage_breakdown: [
      {
        key: 'case_opened',
        name_he: 'פתיחת תיק',
        name_en: 'Case Opened',
        color: '#888888',
        sort_order: 1,
        avg_days: 61.8,
        n: 31,
      },
    ],
    status_snapshot: [],
    by_advisor: [],
    financial: {
      active_loan_volume: 0,
      active_fee_total: 0,
      executed_fee_total: 0,
      executed_payout_total: 0,
      // The RPC still emits this; the schema has no such key and must not choke.
      executed_expected_income_total: 0,
    },
  };
}

describe('StatisticsSummarySchema', () => {
  it('accepts the migration-243 payload including the two new sections', () => {
    const parsed = StatisticsSummarySchema.safeParse(payload());
    expect(parsed.success).toBe(true);
    expect(parsed.data?.cycle_time?.n).toBe(15);
    expect(parsed.data?.cycle_time?.buckets).toHaveLength(5);
    expect(parsed.data?.stage_breakdown[0]?.avg_days).toBe(61.8);
  });

  it('still parses a pre-243 payload, defaulting the new sections', () => {
    // The rollout window: new code, database not yet migrated. Without the
    // .default() calls this would blank the entire dashboard.
    const legacy = payload();
    delete legacy.cycle_time;
    delete legacy.stage_breakdown;

    const parsed = StatisticsSummarySchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.cycle_time).toBeNull();
    expect(parsed.data?.stage_breakdown).toEqual([]);
  });

  it('tolerates a null average when no case has reached execution yet', () => {
    const empty = payload();
    empty.cycle_time = { n: 0, avg_days: null, buckets: [] };

    const parsed = StatisticsSummarySchema.safeParse(empty);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.cycle_time?.avg_days).toBeNull();
  });

  it('rejects a payload missing a core KPI rather than rendering a wrong number', () => {
    const broken = payload();
    broken.kpis = { active_cases: 1 };
    expect(StatisticsSummarySchema.safeParse(broken).success).toBe(false);
  });
});
