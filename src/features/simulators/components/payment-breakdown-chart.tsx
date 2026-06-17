'use client';

import {
  Bar,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslations } from 'next-intl';

import { sampleAnnualCurve } from '../domain/curve-sampling';
import { agorotToNis, formatMoney } from '../utils/format';

import type { CurvePoint } from '../types';

type Props = {
  principalCurve: ReadonlyArray<CurvePoint>;
  interestCurve: ReadonlyArray<CurvePoint>;
};

/**
 * Stacked principal + interest bars per year, with the total monthly payment as
 * a line on top. Values are pre-aggregated by the engine; this only samples to
 * annual buckets. Bare content — its CollapsibleSection supplies the title.
 */
export function PaymentBreakdownChart({ principalCurve, interestCurve }: Props) {
  const t = useTranslations('simulators.mix.breakdown');
  const principal = sampleAnnualCurve(principalCurve);
  const interest = sampleAnnualCurve(interestCurve);
  const data = principal.map((point, index) => {
    const principalNis = agorotToNis(point.value);
    const interestNis = agorotToNis(interest[index]?.value ?? 0);
    return { year: point.year, principal: principalNis, interest: interestNis, payment: principalNis + interestNis };
  });

  return (
    <div className="h-56">
      {/* minHeight floor — prevents Recharts from measuring a 0-height container and logging width/height(-1). */}
      <ResponsiveContainer width="100%" height="100%" minHeight={224}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={64} />
          <Tooltip
            formatter={(value) => formatMoney(Number(value) * 100)}
            labelFormatter={(value) => t('yearLabel', { year: value })}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="principal" name={t('principal')} stackId="payment" fill="var(--color-sim-series-1)" />
          <Bar dataKey="interest" name={t('interest')} stackId="payment" fill="var(--color-sim-series-2)" radius={[3, 3, 0, 0]} />
          <Line type="monotone" dataKey="payment" name={t('payment')} stroke="var(--color-brand-black)" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
