export type {
  StatisticsSummary,
  MonthlyTrend,
  MonthlyTrendPoint,
  StatusSnapshot,
  AdvisorStat,
} from './schemas/statistics.schema';

/**
 * Reporting-period presets driving the KPI / advisor / financial sections.
 * The trend chart always shows a trailing window independent of this.
 */
export const STATISTICS_PRESETS = [
  'this_month',
  'last_month',
  'last_3_months',
  'this_year',
] as const;

export type StatisticsPreset = (typeof STATISTICS_PRESETS)[number];

/** All valid period keys — the presets plus an explicit custom range. */
export const STATISTICS_PERIODS = [...STATISTICS_PRESETS, 'custom'] as const;

export type StatisticsPeriod = (typeof STATISTICS_PERIODS)[number];

export const DEFAULT_STATISTICS_PERIOD: StatisticsPeriod = 'this_month';

/** An inclusive custom range as ISO calendar dates (YYYY-MM-DD). */
export type DateRange = {
  from: string;
  to: string;
};
