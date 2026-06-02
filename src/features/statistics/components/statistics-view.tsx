import { useTranslations } from 'next-intl';

import { AdvisorBreakdown } from './advisor-breakdown';
import { FinancialSummary } from './financial-summary';
import { KpiGrid } from './kpi-grid';
import { MonthlyTrendChart } from './monthly-trend-chart';
import { PeriodSelector } from './period-selector';
import { PipelineFunnel } from './pipeline-funnel';

import type { MonthlyTrend, StatisticsSummary } from '../schemas/statistics.schema';
import type { StatisticsPeriod } from '../types';

type Props = {
  summary: StatisticsSummary | null;
  trend: MonthlyTrend;
  period: StatisticsPeriod;
};

export function StatisticsView({ summary, trend, period }: Props) {
  const t = useTranslations('statistics');

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-neutral-950">{t('title')}</h1>
          <p className="text-sm text-neutral-500">{t('subtitle')}</p>
        </div>
        <PeriodSelector active={period} />
      </div>

      {summary === null ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
          <p className="font-medium text-neutral-700">{t('empty.title')}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-neutral-400">{t('empty.body')}</p>
        </div>
      ) : (
        <>
          <KpiGrid summary={summary} trend={trend} period={period} />
          <MonthlyTrendChart trend={trend} />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <PipelineFunnel snapshot={summary.status_snapshot} />
            <AdvisorBreakdown rows={summary.by_advisor} />
          </div>
          <FinancialSummary financial={summary.financial} />
        </>
      )}
    </div>
  );
}
