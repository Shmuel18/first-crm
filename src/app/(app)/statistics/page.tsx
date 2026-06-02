import { redirect } from 'next/navigation';

import { StatisticsView } from '@/features/statistics/components/statistics-view';
import { parseCustomRange, parseStatisticsPeriod } from '@/features/statistics/domain/period';
import {
  getStatisticsMonthlyTrend,
  getStatisticsSummary,
} from '@/features/statistics/services/statistics.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Trailing window for the opened-vs-executed trend chart, independent of the
// KPI period selector.
const TREND_MONTHS = 12;

export default async function StatisticsPage({ searchParams }: Props) {
  // Manager-only. RLS + the RPC's is_admin() gate enforce this server-side too;
  // this redirect is the user-facing guard so advisors never see a blank page.
  const isManager = await isCurrentUserAdmin();
  if (!isManager) {
    redirect('/cases');
  }

  const sp = await searchParams;
  const period = parseStatisticsPeriod(sp.period);
  const range = period === 'custom' ? parseCustomRange(sp) : null;

  const [summary, trend] = await Promise.all([
    getStatisticsSummary(period, range),
    getStatisticsMonthlyTrend(TREND_MONTHS),
  ]);

  return <StatisticsView summary={summary} trend={trend} period={period} />;
}
