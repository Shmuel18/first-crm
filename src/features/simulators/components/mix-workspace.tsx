'use client';

import { useState, useTransition } from 'react';

import { Plus, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { setPrimaryScenarioAction } from '../actions/set-primary-scenario';
import { MixCalculator } from './mix-calculator';

import type { MortgageScenarioWithTracks } from '../services/scenarios.service';
import type { MixInput, PropertyKind, RegulatoryThresholds } from '../types';

type Tab = {
  key: string;
  id: string | null;
  title: string;
  mix: MixInput;
  propertyKind: PropertyKind;
  conclusion: string;
};

type Props = {
  scenarios: ReadonlyArray<MortgageScenarioWithTracks>;
  /** Seed for a brand-new mix tab (case-prefilled, or the standalone default). */
  newMixSeed: MixInput;
  thresholds: RegulatoryThresholds;
  caseId?: string;
  primaryBorrowerId?: string | null;
  monthlyNetIncome?: number;
  monthlyObligations?: number;
  /** View-only viewer of the case: hide "new tab" + make each calculator
   *  read-only (no edit affordances, no auto-save) — C-036 / SIM-PERSIST-2. */
  readOnly?: boolean;
};

function tabFromScenario(s: MortgageScenarioWithTracks): Tab {
  return {
    key: s.id,
    id: s.id,
    // `inputs` is the MixInput we persist in save-scenario's buildSavePayload.
    mix: s.inputs as unknown as MixInput,
    title: s.title,
    propertyKind: (s.property_kind as PropertyKind | null) ?? 'first_home',
    conclusion: s.advisor_conclusion ?? '',
  };
}

/**
 * Tabbed mix workspace: each saved scenario is a tab; "+" opens a new draft.
 * All tabs stay mounted (switching just toggles visibility) so edits and their
 * debounced auto-save are never lost; only the active tab renders its charts.
 */
export function MixWorkspace({
  scenarios,
  newMixSeed,
  thresholds,
  caseId,
  primaryBorrowerId = null,
  monthlyNetIncome,
  monthlyObligations,
  readOnly = false,
}: Props) {
  const t = useTranslations('simulators');
  const tTools = useTranslations('simulators.tools');
  const tPrimary = useTranslations('simulators.mix.primary');
  const makeDraft = (ordinal: number): Tab => ({
    key: crypto.randomUUID(),
    id: null,
    mix: newMixSeed,
    title: `${tTools('mix')} ${ordinal}`,
    propertyKind: 'first_home',
    conclusion: '',
  });

  const [tabs, setTabs] = useState<Tab[]>(() =>
    scenarios.length > 0
      ? scenarios.map(tabFromScenario)
      : [{ key: 'draft-initial', id: null, mix: newMixSeed, title: `${tTools('mix')} 1`, propertyKind: 'first_home', conclusion: '' }],
  );
  const [activeKey, setActiveKey] = useState<string>(() => tabs[0]?.key ?? 'draft-initial');
  // Multi-select: every mix flagged here is embedded in the bank PDF (own page).
  const [includedIds, setIncludedIds] = useState<Set<string>>(
    () => new Set(scenarios.filter((s) => s.is_primary).map((s) => s.id)),
  );
  const [primaryPending, startPrimary] = useTransition();

  const handleToggleInclude = (scenarioId: string, include: boolean) => {
    if (!caseId) return;
    const prev = includedIds;
    setIncludedIds((cur) => {
      const next = new Set(cur);
      if (include) next.add(scenarioId);
      else next.delete(scenarioId);
      return next;
    });
    startPrimary(async () => {
      const res = await setPrimaryScenarioAction({ scenarioId, caseId, isPrimary: include });
      if (!res.ok) {
        setIncludedIds(prev);
        toast.error(tPrimary('error'));
      }
    });
  };

  const addTab = () => {
    const tab = makeDraft(tabs.length + 1);
    setTabs((prev) => [...prev, tab]);
    setActiveKey(tab.key);
  };

  const handleCreated = (key: string, id: string) =>
    setTabs((prev) => prev.map((tab) => (tab.key === key ? { ...tab, id } : tab)));
  const handleSaved = (key: string, title: string) =>
    setTabs((prev) => prev.map((tab) => (tab.key === key ? { ...tab, title } : tab)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={t('mix.title')}>
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveKey(tab.key)}
              className={`inline-flex h-9 max-w-52 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition ${
                active
                  ? 'border-brand-gold-dark bg-brand-black text-brand-gold'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {tab.id && includedIds.has(tab.id) ? (
                <Star className="size-3.5 shrink-0 fill-brand-gold text-brand-gold-dark" aria-label={tPrimary('marked')} />
              ) : null}
              <span className="truncate">{tab.title || tTools('mix')}</span>
            </button>
          );
        })}
        {!readOnly && (
          <button
            type="button"
            onClick={addTab}
            aria-label={t('saved.new')}
            title={t('saved.new')}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-brand-gold/50 text-brand-gold-text transition hover:bg-brand-gold-soft"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {tabs.map((tab) => (
        <div key={tab.key} hidden={tab.key !== activeKey}>
          <MixCalculator
            active={tab.key === activeKey}
            readOnly={readOnly}
            thresholds={thresholds}
            caseId={caseId}
            primaryBorrowerId={primaryBorrowerId}
            scenarioId={tab.id ?? undefined}
            initialInput={tab.mix}
            initialPropertyKind={tab.propertyKind}
            initialTitle={tab.title}
            initialConclusion={tab.conclusion}
            monthlyNetIncome={monthlyNetIncome}
            monthlyObligations={monthlyObligations}
            isPrimary={tab.id != null && includedIds.has(tab.id)}
            primaryPending={primaryPending}
            onSetPrimary={caseId ? (include) => tab.id && handleToggleInclude(tab.id, include) : undefined}
            onCreated={(id) => handleCreated(tab.key, id)}
            onSaved={(title) => handleSaved(tab.key, title)}
          />
        </div>
      ))}
    </div>
  );
}
