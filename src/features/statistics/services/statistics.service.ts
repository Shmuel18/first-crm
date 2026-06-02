import { createClient } from '@/lib/supabase/server';

import {
  MonthlyTrendSchema,
  StatisticsSummarySchema,
} from '../schemas/statistics.schema';

import type { MonthlyTrend, StatisticsSummary } from '../schemas/statistics.schema';
import type { DateRange, StatisticsPeriod } from '../types';

/**
 * Data access for the manager statistics dashboard. Both reads go through the
 * SECURITY DEFINER RPCs in migration 133, which gate on is_admin() server-side
 * — so a non-admin call raises and surfaces here as a logged error + null/[]
 * (never the raw Postgres message). The page also guards with isCurrentUserAdmin
 * before rendering; this is the defense-in-depth layer.
 *
 * The generated database types don't yet include these RPCs, so the client is
 * narrowed locally to the exact call shape (same pattern as layout bootstrap).
 */

type SummaryRpcClient = {
  rpc(
    fn: 'get_statistics_summary',
    args: { p_period: StatisticsPeriod; p_from: string | null; p_to: string | null },
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

type TrendRpcClient = {
  rpc(
    fn: 'get_statistics_monthly_trend',
    args: { p_months: number },
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function getStatisticsSummary(
  period: StatisticsPeriod,
  range?: DateRange | null,
): Promise<StatisticsSummary | null> {
  const supabase = await createClient();
  const client = supabase as unknown as SummaryRpcClient;

  const { data, error } = await client.rpc('get_statistics_summary', {
    p_period: period,
    p_from: range?.from ?? null,
    p_to: range?.to ?? null,
  });
  if (error) {
    console.error('[statistics] get_statistics_summary rpc error', error);
    return null;
  }

  const parsed = StatisticsSummarySchema.safeParse(data);
  if (!parsed.success) {
    console.error('[statistics] summary parse failed', parsed.error.flatten());
    return null;
  }
  return parsed.data;
}

export async function getStatisticsMonthlyTrend(months: number): Promise<MonthlyTrend> {
  const supabase = await createClient();
  const client = supabase as unknown as TrendRpcClient;

  const { data, error } = await client.rpc('get_statistics_monthly_trend', {
    p_months: months,
  });
  if (error) {
    console.error('[statistics] get_statistics_monthly_trend rpc error', error);
    return [];
  }

  const parsed = MonthlyTrendSchema.safeParse(data);
  if (!parsed.success) {
    console.error('[statistics] trend parse failed', parsed.error.flatten());
    return [];
  }
  return parsed.data;
}
