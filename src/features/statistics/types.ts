export type {
  StatisticsSummary,
  MonthlyTrend,
  MonthlyTrendPoint,
  StatusSnapshot,
  AdvisorStat,
} from './schemas/statistics.schema';

/**
 * Reporting-period presets driving the KPI / advisor / financial sections.
 * The trend chart always shows a trailing window independent of this. Custom
 * date ranges are intentionally out of scope for v1 — these presets cover the
 * "end of month" question the dashboard exists to answer.
 */
export const STATISTICS_PERIODS = [
  'this_month',
  'last_month',
  'last_3_months',
  'this_year',
] as const;

export type StatisticsPeriod = (typeof STATISTICS_PERIODS)[number];

export const DEFAULT_STATISTICS_PERIOD: StatisticsPeriod = 'this_month';

/** A resolved half-open instant range [from, to) in ISO-8601. */
export type DateRange = {
  from: string;
  to: string;
};
