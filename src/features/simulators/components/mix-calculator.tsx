'use client';

import { useMemo, useTransition } from 'react';

import { Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { saveScenarioAction } from '../actions/save-scenario';
import { mixDti } from '../domain/mix-dti';
import { useMixCalculator } from '../hooks/use-mix-calculator';
import { AmortizationTable } from './amortization-table';
import { BasketPresets } from './basket-presets';
import { KpiStrip } from './kpi-strip';
import { MixChart } from './mix-chart';
import { MixCompositionBar } from './mix-composition-bar';
import { MixInputsBar } from './mix-inputs-bar';
import { MonthStatePanel } from './month-state-panel';
import { PaymentBreakdownChart } from './payment-breakdown-chart';
import { RegulatoryViolationsBanner } from './regulatory-violations-banner';
import { TrackTable } from './track-table';

import type { MixInput, PropertyKind, RegulatoryThresholds } from '../types';

type Props = {
  thresholds: RegulatoryThresholds;
  caseId?: string;
  primaryBorrowerId?: string | null;
  initialInput?: MixInput;
  initialPropertyKind?: PropertyKind;
  /** Present → "save" updates this existing scenario in place. */
  scenarioId?: string;
  initialTitle?: string;
  initialConclusion?: string;
  /** When provided (in-case view, borrower income known) → shows a live total-DTI tile. */
  monthlyNetIncome?: number;
  monthlyObligations?: number;
};

const fieldClass =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 shadow-xs outline-none transition focus:border-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/30';

export function MixCalculator({
  thresholds,
  caseId,
  primaryBorrowerId = null,
  initialInput,
  initialPropertyKind,
  scenarioId,
  initialTitle,
  initialConclusion,
  monthlyNetIncome,
  monthlyObligations,
}: Props) {
  const t = useTranslations('simulators.mix');
  const [isSaving, startSaving] = useTransition();
  const calc = useMixCalculator({ thresholds, initialInput, initialPropertyKind, initialTitle, initialConclusion });
  const dti = useMemo(
    () =>
      monthlyNetIncome === undefined
        ? null
        : mixDti({
            firstPayment: calc.result.firstPayment,
            stressPayment: calc.result.maxPayment,
            netIncomeMonthly: monthlyNetIncome,
            obligationsMonthly: monthlyObligations ?? 0,
          }),
    [monthlyNetIncome, monthlyObligations, calc.result.firstPayment, calc.result.maxPayment],
  );
  const isEdit = Boolean(scenarioId);
  const saveDisabled = calc.violations.length > 0 || isSaving || calc.title.trim().length === 0;
  // Why the button is disabled — surfaced so the user isn't left guessing at a
  // greyed-out "save" (the #1 "save doesn't work" report). Title gate first
  // (the common case), then regulatory violations (which also show a banner).
  const disabledReason =
    isSaving
      ? null
      : calc.title.trim().length === 0
        ? t('saveDisabled.noTitle')
        : calc.violations.length > 0
          ? t('saveDisabled.violations')
          : null;

  const handleSave = () => {
    startSaving(async () => {
      const result = await saveScenarioAction({
        scenarioId: scenarioId ?? null,
        caseId: caseId ?? null,
        primaryBorrowerId,
        kind: 'mix',
        title: calc.title,
        propertyKind: calc.propertyKind,
        mix: { ...calc.mix, tracks: [...calc.mix.tracks] },
        advisorConclusion: calc.advisorConclusion || null,
      });
      if (result.ok) toast.success(t(isEdit ? 'updateSuccess' : 'saveSuccess'));
      else toast.error(t(`errors.${result.error}`));
    });
  };

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-neutral-700">{t('inputs.scenarioTitle')}</span>
        <input
          className={`${fieldClass} h-11 text-base font-medium`}
          value={calc.title}
          onChange={(e) => calc.setTitle(e.target.value)}
          placeholder={t('inputs.scenarioTitle')}
        />
      </label>

      <RegulatoryViolationsBanner violations={calc.violations} />
      <MixInputsBar
        propertyKind={calc.propertyKind}
        mix={calc.mix}
        onPropertyKindChange={calc.setPropertyKind}
        onMoneyChange={calc.setMoney}
        onTermChange={calc.setTermMonths}
      />
      <KpiStrip result={calc.result} exposure={calc.exposure} dti={dti} />
      <MixCompositionBar slices={calc.composition} />
      <BasketPresets onLoad={calc.loadBasket} />
      <TrackTable
        tracks={calc.mix.tracks}
        summaries={calc.result.tracks}
        onAdd={calc.addTrack}
        onRemove={calc.removeTrack}
        onUpdate={calc.updateTrack}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <MonthStatePanel result={calc.result} mortgageAmount={calc.mix.mortgageAmount} />
        <MixChart titleKey="balanceCurve" points={calc.result.balanceCurve} />
        <PaymentBreakdownChart principalCurve={calc.result.principalCurve} interestCurve={calc.result.interestCurve} />
      </div>

      <AmortizationTable result={calc.result} />

      <label className="block rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <span className="mb-1.5 block text-sm font-medium text-neutral-700">{t('inputs.advisorConclusion')}</span>
        <textarea
          className={`${fieldClass} min-h-20 py-2 text-sm`}
          value={calc.advisorConclusion}
          onChange={(e) => calc.setAdvisorConclusion(e.target.value)}
        />
      </label>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200 pt-4">
        {disabledReason ? (
          <span className="text-xs font-medium text-brand-gold-text">{disabledReason}</span>
        ) : (
          <span className="text-xs text-neutral-500">{t('results.snapshotNote')}</span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saveDisabled}
          title={disabledReason ?? undefined}
          className="btn-gold flex h-11 items-center justify-center gap-2 rounded-lg px-6 disabled:pointer-events-none disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          {isSaving ? t('saving') : isEdit ? t('update') : t('save')}
        </button>
      </div>
    </div>
  );
}
