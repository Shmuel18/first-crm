// Public API for the statistics feature.
export { StatisticsView } from './components/statistics-view';
export {
  getStatisticsMonthlyTrend,
  getStatisticsSummary,
} from './services/statistics.service';
export { parseStatisticsPeriod } from './domain/period';
export { DEFAULT_STATISTICS_PERIOD, STATISTICS_PERIODS } from './types';
export type {
  AdvisorStat,
  MonthlyTrend,
  MonthlyTrendPoint,
  StatisticsPeriod,
  StatisticsSummary,
  StatusSnapshot,
} from './types';
