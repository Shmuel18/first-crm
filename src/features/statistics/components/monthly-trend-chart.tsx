'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLocale, useTranslations } from 'next-intl';

import { parseLocale } from '@/lib/i18n/direction';
import { formatMonthLabel } from '../domain/period';
import { formatInt } from '../utils/format';

import type { MonthlyTrend } from '../schemas/statistics.schema';

type Props = { trend: MonthlyTrend };

export function MonthlyTrendChart({ trend }: Props) {
  const t = useTranslations('statistics');
  const locale = parseLocale(useLocale());
  const data = trend.map((point) => ({
    month: formatMonthLabel(point.month, locale),
    opened: point.opened,
    executed: point.executed,
  }));

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-4 font-display text-lg font-semibold text-neutral-950">
        {t('trend.title')}
      </h2>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%" minHeight={260}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-neutral-200)" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} allowDecimals={false} width={36} />
            <Tooltip
              formatter={(value) => formatInt(Number(value))}
              cursor={{ fill: 'var(--color-brand-gold-soft)' }}
            />
            <Legend />
            <Bar dataKey="opened" name={t('trend.opened')} fill="var(--color-neutral-400)" radius={[4, 4, 0, 0]} />
            <Bar
              dataKey="executed"
              name={t('trend.executed')}
              fill="var(--color-brand-gold-text)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
