'use client';

import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslations } from 'next-intl';

import { SIM_SERIES_COLORS } from '../constants';
import type { CurvePoint } from '../types';
import { agorotToNis, formatCompactNis, formatMoney } from '../utils/format';

export type OverlaySeries = { key: string; name: string; points: ReadonlyArray<CurvePoint> };
type Props = { title: string; series: ReadonlyArray<OverlaySeries> };

export function SeriesOverlayChart({ title, series }: Props) {
  const t = useTranslations('simulators');
  const data = buildSeriesData(series);

  return (
    <section className="min-h-72 rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-4 font-display text-lg font-semibold text-neutral-950">{title}</h2>
      <div className="h-72 sm:h-64">
        {/* minHeight gives the container a definite floor so Recharts never
            measures a 0-height parent (which logs "width(-1)/height(-1)…"
            when the chart briefly renders before/while its container is
            laid out). */}
        <ResponsiveContainer width="100%" height="100%" minHeight={256}>
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={44} tickFormatter={formatCompactNis} />
            <Tooltip
              formatter={(value, name) => [formatMoney(Number(value) * 100), name]}
              labelFormatter={(value) => t('compare.yearLabel', { year: value })}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.map((item, index) => (
              <Line
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.name}
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

function buildSeriesData(series: ReadonlyArray<OverlaySeries>): ReadonlyArray<Record<string, number>> {
  const months = new Set<number>();
  for (const item of series) {
    for (const point of item.points) {
      if (point.monthIndex % 12 === 0) months.add(point.monthIndex);
    }
  }
  const byKey = series.map((item) => ({
    key: item.key,
    byMonth: new Map(item.points.map((point) => [point.monthIndex, agorotToNis(point.value)])),
  }));

  return [...months]
    .sort((a, b) => a - b)
    .map((month) => {
      const entry: Record<string, number> = { year: month / 12 };
      for (const item of byKey) {
        const value = item.byMonth.get(month);
        if (value !== undefined) entry[item.key] = value;
      }
      return entry;
    });
}
