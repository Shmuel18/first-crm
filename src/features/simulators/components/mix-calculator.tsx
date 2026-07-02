'use client';

import { useMemo } from 'react';

import { Check, CircleAlert, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { mixDti } from '../domain/mix-dti';
import { useMixCalculator } from '../hooks/use-mix-calculator';
import { useScenarioAutosave, type AutosaveStatus } from '../hooks/use-scenario-autosave';
import { AnalysisSection } from './analysis-section';
import { BasketPresets } from './basket-presets';
import { KpiStrip } from './kpi-strip';
import { MixCompositionBar } from './mix-composition-bar';
import { MixInputsBar } from './mix-inputs-bar';
import { PrimaryMixToggle } from './primary-mix-toggle';
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
  /** View-only viewer of the case (no can_edit_case): disable every input and
   *  skip auto-save (the server rejects the write anyway, mig 195) — C-036. */
  readOnly?: boolean;
  /** Whether this saved mix is the case's primary (bank-PDF) mix. */
  isPrimary?: boolean;
  /** True while a set-primary request is in flight (shared across tabs). */
  primaryPending?: boolean;
  /** Toggle this mix as the case's primary. Absent → no primary affordance. */
  onSetPrimary?: (makePrimary: boolean) => void;
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
  readOnly = false,
  isPrimary = false,
  primaryPending = false,
  onSetPrimary,
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

  const { status, saveNow } = useScenarioAutosave({
    scenarioId: scenarioId ?? null,
    caseId: caseId ?? null,
    primaryBorrowerId,
    title: calc.title,
    propertyKind: calc.propertyKind,
    mix: calc.mix,
    advisorConclusion: calc.advisorConclusion,
    hasViolations: calc.violations.length > 0,
    disabled: readOnly,
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
      {/* A disabled <fieldset> natively makes every nested input/select/button
          non-interactive for a view-only viewer — no per-field wiring (C-036). */}
      <fieldset disabled={readOnly} className="space-y-5 min-w-0 border-0 p-0 m-0">
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
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
        <div className="text-sm">
          <SaveStatus status={status} blockedReason={blockedReason} t={t} />
        </div>
        {/* Report actions appear as soon as the mix is valid (titled + no
            violations) — no advisor conclusion required. When the scenario
            isn't auto-saved yet, download/send saves it first (SIM-PRINT-1).
            The primary-mix toggle still needs a persisted scenario. */}
        {blockedReason === null ? (
          <div className="flex flex-wrap items-center gap-2">
            {scenarioId && caseId && !readOnly && onSetPrimary ? (
              <PrimaryMixToggle isPrimary={isPrimary} pending={primaryPending} onToggle={() => onSetPrimary(!isPrimary)} />
            ) : null}
            <ScenarioReportActions
              scenarioId={scenarioId}
              onEnsureSaved={saveNow}
              conclusion={calc.advisorConclusion}
              canSend={Boolean(caseId)}
            />
          </div>
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
  status: AutosaveStatus;
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
