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

import type { CurvePoint } from '../types';
import { agorotToNis, formatMoney } from '../utils/format';

type Props = { titleKey: 'paymentCurve' | 'balanceCurve'; points: ReadonlyArray<CurvePoint> };

export function MixChart({ titleKey, points }: Props) {
  const t = useTranslations('simulators.mix.results');
  const data = points
    .filter((point) => point.monthIndex === 1 || point.monthIndex % 12 === 0)
    .map((point) => ({ month: point.monthIndex, year: Math.ceil(point.monthIndex / 12), value: agorotToNis(point.value) }));

  return (
    <section className="min-h-72 rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-4 font-display text-lg font-semibold text-neutral-950">{t(titleKey)}</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
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
    </section>
  );
}
