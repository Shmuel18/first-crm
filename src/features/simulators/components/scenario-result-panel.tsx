'use client';

import { useTranslations } from 'next-intl';

import type { StressResult } from '../domain/scenario-stress';
import type { MixResult } from '../types';
import { formatMoney, formatPct } from '../utils/format';
import { RiskBadge } from './risk-badge';
import { SeriesOverlayChart } from './series-overlay-chart';

type Props = { result: StressResult };

const METRICS: ReadonlyArray<{ key: string; get: (mix: MixResult) => number }> = [
  { key: 'firstPayment', get: (m) => m.firstPayment },
  { key: 'maxPayment', get: (m) => m.maxPayment },
  { key: 'totalInterest', get: (m) => m.totalInterest },
  { key: 'totalIndexation', get: (m) => m.totalIndexation },
  { key: 'totalCost', get: (m) => m.totalCost },
];

export function ScenarioResultPanel({ result }: Props) {
  const t = useTranslations('simulators.scenario.result');
  const series = [
    { key: 'baseline', name: t('baseline'), points: result.baseline.paymentCurve },
    { key: 'stressed', name: t('stressed'), points: result.stressed.paymentCurve },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-neutral-950">{t('title')}</h2>
          <RiskBadge risk={result.risk} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Highlight label={t('paymentIncrease')} value={formatPct(result.paymentIncreasePct)} tone="text-red-600" />
          <Highlight
            label={t('thresholdCross')}
            value={result.thresholdCrossMonth === null ? t('noCross') : t('monthValue', { month: result.thresholdCrossMonth })}
            tone="text-neutral-950"
          />
          <Highlight label={t('linkedGrowth')} value={formatMoney(result.linkedPrincipalGrowth)} tone="text-amber-600" />
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-4 font-display text-lg font-semibold text-neutral-950">{t('compareTitle')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-3 py-2 text-start font-medium">{t('metric')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('baseline')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('stressed')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('delta')}</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((metric) => {
                const base = metric.get(result.baseline);
                const stressed = metric.get(result.stressed);
                const delta = stressed - base;
                return (
                  <tr key={metric.key} className="border-b border-neutral-100 last:border-0">
                    <td className="px-3 py-2 text-neutral-600">{t(`metrics.${metric.key}`)}</td>
                    <td className="px-3 py-2">{formatMoney(base)}</td>
                    <td className="px-3 py-2 font-medium">{formatMoney(stressed)}</td>
                    <td className={`px-3 py-2 font-medium ${delta > 0 ? 'text-red-600' : 'text-neutral-500'}`}>
                      {delta > 0 ? '+' : ''}{formatMoney(delta)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <SeriesOverlayChart title={t('overlayTitle')} series={series} />
    </div>
  );
}

function Highlight({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}
