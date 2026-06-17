'use client';

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslations } from 'next-intl';

import { sampleAnnualCurve } from '../domain/curve-sampling';
import { agorotToNis, formatMoney } from '../utils/format';

import type { CurvePoint } from '../types';

type Props = { points: ReadonlyArray<CurvePoint> };

/** Bare annual line chart of a money curve; its CollapsibleSection supplies the title. */
export function MixChart({ points }: Props) {
  const t = useTranslations('simulators.mix.results');
  const data = sampleAnnualCurve(points).map((point) => ({ year: point.year, value: agorotToNis(point.value) }));

  return (
    <div className="h-56">
      {/* minHeight floor — prevents Recharts from measuring a 0-height container and logging width/height(-1). */}
      <ResponsiveContainer width="100%" height="100%" minHeight={224}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={64} />
          <Tooltip
            formatter={(value) => formatMoney(Number(value) * 100)}
            labelFormatter={(value) => t('yearLabel', { year: value })}
          />
          <Line type="monotone" dataKey="value" stroke="var(--color-brand-gold-text)" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
