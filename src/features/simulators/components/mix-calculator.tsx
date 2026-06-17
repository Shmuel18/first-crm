'use client';

import { useMemo } from 'react';

import { Check, CircleAlert, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { mixDti } from '../domain/mix-dti';
import { useMixCalculator } from '../hooks/use-mix-calculator';
import { useScenarioAutosave } from '../hooks/use-scenario-autosave';
import { AnalysisSection } from './analysis-section';
import { BasketPresets } from './basket-presets';
import { KpiStrip } from './kpi-strip';
import { MixCompositionBar } from './mix-composition-bar';
import { MixInputsBar } from './mix-inputs-bar';
import { RegulatoryViolationsBanner } from './regulatory-violations-banner';
import { ScenarioReportActions } from './scenario-report-actions';
import { TrackTable } from './track-table';

import type { MixInput, PropertyKind, RegulatoryThresholds } from '../types';

type Props = {
  thresholds: RegulatoryThresholds;
  /** false when this tab is hidden — skips the heavy charts to keep idle tabs cheap. */
  active?: boolean;
  caseId?: string;
  primaryBorrowerId?: string | null;
  initialInput?: MixInput;
  initialPropertyKind?: PropertyKind;
  /** Present → auto-save updates this existing scenario; absent → first save creates it. */
  scenarioId?: string;
  initialTitle?: string;
  initialConclusion?: string;
  /** When provided (in-case view, borrower income known) → shows a live total-DTI tile. */
  monthlyNetIncome?: number;
  monthlyObligations?: number;
  onCreated?: (scenarioId: string) => void;
  onSaved?: (title: string) => void;
};

const fieldClass =
  'w-full rounded-lg border border-neutral-200 bg-white px-3 shadow-xs outline-none transition focus:border-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/30';

export function MixCalculator({
  thresholds,
  active = true,
  caseId,
  primaryBorrowerId = null,
  initialInput,
  initialPropertyKind,
  scenarioId,
  initialTitle,
  initialConclusion,
  monthlyNetIncome,
  monthlyObligations,
  onCreated,
  onSaved,
}: Props) {
  const t = useTranslations('simulators.mix');
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

  const status = useScenarioAutosave({
    scenarioId: scenarioId ?? null,
    caseId: caseId ?? null,
    primaryBorrowerId,
    title: calc.title,
    propertyKind: calc.propertyKind,
    mix: calc.mix,
    advisorConclusion: calc.advisorConclusion,
    hasViolations: calc.violations.length > 0,
    onCreated,
    onSaved,
  });

  // Can't save while blocked — surface why (title gate first, then violations).
  const blockedReason =
    calc.title.trim().length === 0
      ? t('saveDisabled.noTitle')
      : calc.violations.length > 0
        ? t('saveDisabled.violations')
        : null;

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

      <AnalysisSection result={calc.result} mortgageAmount={calc.mix.mortgageAmount} active={active} />

      <label className="block rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <span className="mb-1.5 block text-sm font-medium text-neutral-700">{t('inputs.advisorConclusion')}</span>
        <textarea
          className={`${fieldClass} min-h-20 py-2 text-sm`}
          value={calc.advisorConclusion}
          onChange={(e) => calc.setAdvisorConclusion(e.target.value)}
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
        <div className="text-sm">
          <SaveStatus status={status} blockedReason={blockedReason} t={t} />
        </div>
        {scenarioId ? (
          <ScenarioReportActions scenarioId={scenarioId} conclusion={calc.advisorConclusion} canSend={Boolean(caseId)} />
        ) : null}
      </div>
    </div>
  );
}

function SaveStatus({
  status,
  blockedReason,
  t,
}: {
  status: ReturnType<typeof useScenarioAutosave>;
  blockedReason: string | null;
  t: ReturnType<typeof useTranslations<'simulators.mix'>>;
}) {
  if (blockedReason) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-brand-gold-text">
        <CircleAlert className="size-4" aria-hidden="true" />
        {blockedReason}
      </span>
    );
  }
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-neutral-500">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {t('saving')}
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600">
        <Check className="size-4" aria-hidden="true" />
        {t('saveSuccess')}
      </span>
    );
  }
  if (status === 'error') {
    return <span className="font-medium text-red-600">{t('errors.unknown')}</span>;
  }
  return <span className="text-neutral-500">{t('results.snapshotNote')}</span>;
}
