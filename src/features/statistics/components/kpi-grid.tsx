import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Clock,
  FolderPlus,
  UserPlus,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { KpiCard } from './kpi-card';
import { computeDelta, lastTwoMonths } from '../domain/metrics';
import { formatInt } from '../utils/format';

import type { MonthlyTrend, StatisticsSummary } from '../schemas/statistics.schema';
import type { StatisticsPeriod } from '../types';

type Props = {
  summary: StatisticsSummary;
  trend: MonthlyTrend;
  period: StatisticsPeriod;
};

export function KpiGrid({ summary, trend, period }: Props) {
  const t = useTranslations('statistics');
  const { kpis } = summary;

  // Month-over-month delta is only meaningful for the current-month view; the
  // two trailing months come from the same (timezone-consistent) trend source.
  const { current, previous } = lastTwoMonths(trend);
  const showDelta = period === 'this_month' && current !== null && previous !== null;
  const openedDelta = showDelta ? computeDelta(current.opened, previous.opened) : undefined;
  const executedDelta = showDelta ? computeDelta(current.executed, previous.executed) : undefined;
  const vsLast = t('vsLastMonth');

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        label={t('kpi.activeCases')}
        value={formatInt(kpis.active_cases)}
        icon={Briefcase}
      />
      <KpiCard
        label={t('kpi.openedInPeriod')}
        value={formatInt(kpis.opened_in_period)}
        icon={FolderPlus}
        delta={openedDelta}
        deltaLabel={openedDelta ? vsLast : undefined}
      />
      <KpiCard
        label={t('kpi.executedInPeriod')}
        value={formatInt(kpis.executed_in_period)}
        icon={CheckCircle2}
        delta={executedDelta}
        deltaLabel={executedDelta ? vsLast : undefined}
      />
      <KpiCard
        label={t('kpi.stuckCases')}
        value={formatInt(kpis.stuck_cases)}
        icon={AlertTriangle}
      />
      <KpiCard
        label={t('kpi.avgCycleDays')}
        value={kpis.avg_cycle_days === null ? '—' : formatInt(Math.round(kpis.avg_cycle_days))}
        hint={t('kpi.avgCycleDaysHint')}
        icon={Clock}
      />
      <KpiCard
        label={t('kpi.leadsConverted')}
        value={formatInt(kpis.leads_converted_in_period)}
        icon={UserPlus}
      />
    </div>
  );
}
