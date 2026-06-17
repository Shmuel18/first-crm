'use client';

import { useTranslations } from 'next-intl';

import { useScenarioCalculator } from '../hooks/use-scenario-calculator';
import type { MixInput, PropertyKind } from '../types';
import { LoanBasePanel } from './loan-base-panel';
import { ScenarioInputsPanel } from './scenario-inputs-panel';
import { ScenarioPresetPicker } from './scenario-preset-picker';
import { ScenarioResultPanel } from './scenario-result-panel';
import { TrackTable } from './track-table';

type Props = {
  initialInput?: MixInput;
  initialPropertyKind?: PropertyKind;
};

export function ScenarioCalculator({ initialInput, initialPropertyKind }: Props) {
  const t = useTranslations('simulators.scenario');
  const sc = useScenarioCalculator({ initialInput, initialPropertyKind });

  return (
    <div className="space-y-5">
      <LoanBasePanel
        title={t('mixTitle')}
        subtitle={t('mixSubtitle')}
        base={sc.mix}
        propertyKind={sc.propertyKind}
        onPropertyKindChange={sc.setPropertyKind}
        onMoneyChange={sc.setMoney}
        onTermChange={sc.setTermMonths}
      />
      <TrackTable tracks={sc.mix.tracks} onAdd={sc.addTrack} onRemove={sc.removeTrack} onUpdate={sc.updateTrack} />

      <section className="space-y-4 rounded-xl border border-neutral-200 bg-brand-surface p-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-neutral-950">{t('scenarioTitle')}</h2>
          <p className="mt-1 text-sm text-neutral-500">{t('scenarioSubtitle')}</p>
        </div>
        <ScenarioPresetPicker presetKey={sc.presetKey} onApply={sc.applyPreset} />
        <ScenarioInputsPanel scenario={sc.scenario} onParamChange={sc.setParam} onThresholdChange={sc.setPaymentThreshold} />
      </section>

      <ScenarioResultPanel result={sc.result} />
    </div>
  );
}
