'use client';

import { useTransition } from 'react';

import { Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { saveScenarioAction } from '../actions/save-scenario';
import { useMixCalculator } from '../hooks/use-mix-calculator';
import type { MixInput, PropertyKind, RegulatoryThresholds } from '../types';
import { AmortizationTable } from './amortization-table';
import { KpiStrip } from './kpi-strip';
import { MixChart } from './mix-chart';
import { MixCompositionBar } from './mix-composition-bar';
import { MixInputsPanel } from './mix-inputs-panel';
import { RegulatoryViolationsBanner } from './regulatory-violations-banner';
import { TrackEditor } from './track-editor';

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
};

export function MixCalculator({
  thresholds,
  caseId,
  primaryBorrowerId = null,
  initialInput,
  initialPropertyKind,
  scenarioId,
  initialTitle,
  initialConclusion,
}: Props) {
  const t = useTranslations('simulators.mix');
  const [isSaving, startSaving] = useTransition();
  const calc = useMixCalculator({ thresholds, initialInput, initialPropertyKind, initialTitle, initialConclusion });
  const isEdit = Boolean(scenarioId);
  const saveDisabled = calc.violations.length > 0 || isSaving || calc.title.trim().length === 0;

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
      <RegulatoryViolationsBanner violations={calc.violations} />
      <KpiStrip result={calc.result} />
      <MixCompositionBar slices={calc.composition} />
      <MixInputsPanel
        title={calc.title}
        advisorConclusion={calc.advisorConclusion}
        propertyKind={calc.propertyKind}
        mix={calc.mix}
        onTitleChange={calc.setTitle}
        onConclusionChange={calc.setAdvisorConclusion}
        onPropertyKindChange={calc.setPropertyKind}
        onMoneyChange={calc.setMoney}
        onTermChange={calc.setTermMonths}
      />
      <TrackEditor
        tracks={calc.mix.tracks}
        onAdd={calc.addTrack}
        onRemove={calc.removeTrack}
        onUpdate={calc.updateTrack}
      />
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="text-xs text-neutral-500">{t('results.snapshotNote')}</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saveDisabled}
          className="btn-gold flex h-11 items-center justify-center gap-2 rounded-lg px-6 disabled:pointer-events-none disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          {isSaving ? t('saving') : isEdit ? t('update') : t('save')}
        </button>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <MixChart titleKey="paymentCurve" points={calc.result.paymentCurve} />
        <MixChart titleKey="balanceCurve" points={calc.result.balanceCurve} />
      </div>
      <AmortizationTable result={calc.result} />
    </div>
  );
}
