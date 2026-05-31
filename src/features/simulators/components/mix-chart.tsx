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
import type { CurvePoint } from '../types';
import { agorotToNis, formatMoney } from '../utils/format';

type Props = { titleKey: 'paymentCurve' | 'balanceCurve'; points: ReadonlyArray<CurvePoint> };

export function MixChart({ titleKey, points }: Props) {
  const t = useTranslations('simulators.mix.results');
  const data = sampleAnnualCurve(points).map((point) => ({ year: point.year, value: agorotToNis(point.value) }));

  return (
    <section className="min-h-72 rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-4 font-display text-lg font-semibold text-neutral-950">{t(titleKey)}</h2>
      <div className="h-56">
        {/* minHeight floor — see SeriesOverlayChart: prevents Recharts from
            measuring a 0-height container and logging width/height(-1). */}
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
    </section>
  );
}
