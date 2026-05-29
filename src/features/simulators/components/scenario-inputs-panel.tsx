'use client';

import { useTranslations } from 'next-intl';

import type { StressScenario } from '../domain/scenario-stress';
import { agorotToNis, nisToAgorot } from '../utils/format';

type ScenarioParamKey = 'primeDeltaPct' | 'variableDeltaPct' | 'cpiAnnualPct' | 'changeMonth';

type Props = {
  scenario: StressScenario;
  onParamChange: (field: ScenarioParamKey, value: number) => void;
  onThresholdChange: (value: number | null) => void;
};

const inputClass =
  'h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm shadow-xs outline-none transition focus:border-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/30';
const CHANGE_MONTHS = [12, 24, 36, 48, 60] as const;

export function ScenarioInputsPanel({ scenario, onParamChange, onThresholdChange }: Props) {
  const t = useTranslations('simulators.scenario.params');

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-4 font-display text-lg font-semibold text-neutral-950">{t('title')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <NumberField label={t('primeDelta')} value={scenario.primeDeltaPct} step="0.1" onChange={(v) => onParamChange('primeDeltaPct', v)} />
        <NumberField label={t('variableDelta')} value={scenario.variableDeltaPct} step="0.1" onChange={(v) => onParamChange('variableDeltaPct', v)} />
        <NumberField label={t('cpiAnnual')} value={scenario.cpiAnnualPct} step="0.1" onChange={(v) => onParamChange('cpiAnnualPct', v)} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-neutral-700">{t('changeMonth')}</span>
          <select className={inputClass} value={scenario.changeMonth} onChange={(e) => onParamChange('changeMonth', Number(e.target.value))}>
            {CHANGE_MONTHS.map((month) => (
              <option key={month} value={month}>{t('monthOption', { month })}</option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2 xl:col-span-1">
          <span className="mb-1.5 block text-sm font-medium text-neutral-700">{t('paymentThreshold')}</span>
          <input
            className={inputClass}
            inputMode="numeric"
            placeholder={t('thresholdPlaceholder')}
            value={scenario.paymentThreshold === null ? '' : agorotToNis(scenario.paymentThreshold)}
            onChange={(e) => onThresholdChange(e.target.value.trim() === '' ? null : nisToAgorot(e.target.value))}
          />
        </label>
      </div>
    </section>
  );
}

function NumberField({ label, value, step, onChange }: { label: string; value: number; step?: string; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</span>
      <input className={inputClass} type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
