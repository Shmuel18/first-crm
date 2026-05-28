'use client';

import { useTransition } from 'react';

import { Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { saveScenarioAction } from '../actions/save-scenario';
import { useMixCalculator } from '../hooks/use-mix-calculator';
import type { MixInput, PropertyKind, RegulatoryThresholds } from '../types';
import { AmortizationTable } from './amortization-table';
import { MixChart } from './mix-chart';
import { MixInputsPanel } from './mix-inputs-panel';
import { RegulatoryViolationsBanner } from './regulatory-violations-banner';
import { ResultsSummary } from './results-summary';
import { TrackEditor } from './track-editor';

type Props = {
  thresholds: RegulatoryThresholds;
  caseId?: string;
  primaryBorrowerId?: string | null;
  initialInput?: MixInput;
  initialPropertyKind?: PropertyKind;
};

export function MixCalculator({
  thresholds,
  caseId,
  primaryBorrowerId = null,
  initialInput,
  initialPropertyKind,
}: Props) {
  const t = useTranslations('simulators.mix');
  const [isSaving, startSaving] = useTransition();
  const calc = useMixCalculator({ thresholds, initialInput, initialPropertyKind });
  const saveDisabled = calc.violations.length > 0 || isSaving || calc.title.trim().length === 0;

  const handleSave = () => {
    startSaving(async () => {
      const result = await saveScenarioAction({
        caseId: caseId ?? null,
        primaryBorrowerId,
        kind: 'mix',
        title: calc.title,
        propertyKind: calc.propertyKind,
        mix: { ...calc.mix, tracks: [...calc.mix.tracks] },
        advisorConclusion: calc.advisorConclusion || null,
      });
      if (result.ok) toast.success(t('saveSuccess'));
      else toast.error(t(`errors.${result.error}`));
    });
  };

  return (
    <div className="space-y-5">
      <RegulatoryViolationsBanner violations={calc.violations} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
        <div className="space-y-5">
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
        </div>
        <div className="space-y-5">
          <ResultsSummary result={calc.result} />
          <button
            type="button"
            onClick={handleSave}
            disabled={saveDisabled}
            className="btn-gold flex h-11 w-full items-center justify-center gap-2 rounded-lg disabled:pointer-events-none disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            {isSaving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <MixChart titleKey="paymentCurve" points={calc.result.paymentCurve} />
        <MixChart titleKey="balanceCurve" points={calc.result.balanceCurve} />
      </div>
      <AmortizationTable result={calc.result} />
    </div>
  );
}
