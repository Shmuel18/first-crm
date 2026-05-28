'use client';

import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslations } from 'next-intl';

import { SIM_SERIES_COLORS } from '../constants';
import type { MixComparisonResult } from '../domain/mix-compare';
import { agorotToNis, formatMoney } from '../utils/format';

type Props = { comparison: MixComparisonResult };

export function ComparisonOverlayChart({ comparison }: Props) {
  const t = useTranslations('simulators.compare');
  const { rows } = comparison;
  const data = buildSeriesData(rows);

  return (
    <section className="min-h-72 rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-4 font-display text-lg font-semibold text-neutral-950">{t('overlayTitle')}</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={64} />
            <Tooltip
              formatter={(value, name) => [formatMoney(Number(value) * 100), name]}
              labelFormatter={(value) => t('yearLabel', { year: value })}
            />
            <Legend />
            {rows.map((row, index) => (
              <Line
                key={row.label}
                type="monotone"
                dataKey={row.label}
                name={t('variant', { label: row.label })}
                stroke={SIM_SERIES_COLORS[index % SIM_SERIES_COLORS.length]}
                strokeWidth={2.5}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function buildSeriesData(rows: MixComparisonResult['rows']): ReadonlyArray<Record<string, number>> {
  const months = new Set<number>();
  for (const row of rows) {
    for (const point of row.result.paymentCurve) {
      if (point.monthIndex % 12 === 0) months.add(point.monthIndex);
    }
  }
  const valueByLabel = rows.map((row) => ({
    label: row.label,
    byMonth: new Map(row.result.paymentCurve.map((point) => [point.monthIndex, agorotToNis(point.value)])),
  }));

  return [...months]
    .sort((a, b) => a - b)
    .map((month) => {
      const entry: Record<string, number> = { year: month / 12 };
      for (const series of valueByLabel) {
        const value = series.byMonth.get(month);
        if (value !== undefined) entry[series.label] = value;
      }
      return entry;
    });
}
