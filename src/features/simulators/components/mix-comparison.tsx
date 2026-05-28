'use client';

import { useTranslations } from 'next-intl';

import { useMixComparison, type ComparisonBase } from '../hooks/use-mix-comparison';
import type { PropertyKind, RegulatoryThresholds } from '../types';
import { ComparisonBasePanel } from './comparison-base-panel';
import { ComparisonOverlayChart } from './comparison-overlay-chart';
import { ComparisonRankingCards } from './comparison-ranking-cards';
import { ComparisonTable } from './comparison-table';
import { ComparisonVariantTabs } from './comparison-variant-tabs';
import { RegulatoryViolationsBanner } from './regulatory-violations-banner';
import { TrackEditor } from './track-editor';

type Props = {
  thresholds: RegulatoryThresholds;
  initialBase?: ComparisonBase;
  initialPropertyKind?: PropertyKind;
};

export function MixComparison({ thresholds, initialBase, initialPropertyKind }: Props) {
  const t = useTranslations('simulators.compare');
  const comp = useMixComparison({ thresholds, initialBase, initialPropertyKind });

  return (
    <div className="space-y-5">
      <ComparisonBasePanel
        base={comp.base}
        propertyKind={comp.propertyKind}
        onPropertyKindChange={comp.setPropertyKind}
        onMoneyChange={comp.setMoney}
        onTermChange={comp.setTermMonths}
      />

      <div className="space-y-4 rounded-xl border border-neutral-200 bg-brand-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-neutral-950">{t('editTitle')}</h2>
          <span className="text-sm text-neutral-500">{t('editHint')}</span>
        </div>
        <ComparisonVariantTabs
          variants={comp.variants}
          activeLabel={comp.activeLabel}
          violationsByLabel={comp.violationsByLabel}
          canAddVariant={comp.canAddVariant}
          canRemoveVariant={comp.canRemoveVariant}
          onSelect={comp.setActiveLabel}
          onAdd={comp.addVariant}
          onRemove={comp.removeVariant}
        />
        <RegulatoryViolationsBanner violations={comp.activeViolations} />
        <TrackEditor tracks={comp.activeTracks} onAdd={comp.addTrack} onRemove={comp.removeTrack} onUpdate={comp.updateTrack} />
      </div>

      <ComparisonRankingCards comparison={comp.comparison} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ComparisonTable comparison={comp.comparison} />
        <ComparisonOverlayChart comparison={comp.comparison} />
      </div>
    </div>
  );
}
