import { getTranslations } from 'next-intl/server';

import type { ScenarioReportData } from '../pdf/report-data.service';
import { formatMoney, formatPct } from '../utils/format';

type Props = { data: ScenarioReportData };

/**
 * Read-only summary of a saved scenario, shown on the view and report screens.
 * Pure presentation — the data is assembled server-side by the report data
 * service. Reuses the existing `simulators.mix.*` strings (no new keys).
 */
export async function ScenarioSummary({ data }: Props) {
  const t = await getTranslations('simulators');
  const { loan, result, tracks } = data;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-4 font-display text-lg font-semibold text-neutral-950">{t('mix.inputs.title')}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label={t('mix.inputs.propertyValue')} value={formatMoney(loan.propertyValue)} />
          <Stat label={t('mix.inputs.equity')} value={formatMoney(loan.equity)} />
          <Stat label={t('mix.inputs.mortgageAmount')} value={formatMoney(loan.mortgageAmount)} />
          <Stat label={t('mix.inputs.termMonths')} value={String(loan.termMonths)} />
          <Stat label={t('mix.results.ltv')} value={formatPct(result.ltv)} />
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-4 font-display text-lg font-semibold text-neutral-950">{t('mix.tracks.title')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-3 py-2 text-start font-medium">{t('mix.tracks.type')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('mix.tracks.amount')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('mix.tracks.rate')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('mix.tracks.term')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('mix.tracks.repayment')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('mix.tracks.cpi')}</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((track, index) => (
                <tr key={index} className="border-b border-neutral-100 last:border-0">
                  <td className="px-3 py-2 text-neutral-700">{t(`mix.tracks.types.${track.type}`)}</td>
                  <td className="px-3 py-2">{formatMoney(track.amount)}</td>
                  <td className="px-3 py-2">{formatPct(track.annualRatePct)}</td>
                  <td className="px-3 py-2">{track.termMonths}</td>
                  <td className="px-3 py-2">{t(`mix.tracks.repayments.${track.repayment}`)}</td>
                  <td className="px-3 py-2">{track.cpiAnnualPct === null ? '—' : formatPct(track.cpiAnnualPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-4 font-display text-lg font-semibold text-neutral-950">{t('mix.results.title')}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label={t('mix.results.firstPayment')} value={formatMoney(result.firstPayment)} />
          <Stat label={t('mix.results.averagePayment')} value={formatMoney(result.averagePayment)} />
          <Stat label={t('mix.results.maxPayment')} value={formatMoney(result.maxPayment)} />
          <Stat label={t('mix.results.totalInterest')} value={formatMoney(result.totalInterest)} />
          <Stat label={t('mix.results.totalCost')} value={formatMoney(result.totalCost)} />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-neutral-950">{value}</div>
    </div>
  );
}
