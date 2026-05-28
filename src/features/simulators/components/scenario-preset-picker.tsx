'use client';

import { useTranslations } from 'next-intl';

import type { ScenarioPresetKey } from '../types';

type Props = {
  presetKey: ScenarioPresetKey;
  onApply: (key: Exclude<ScenarioPresetKey, 'custom'>) => void;
};

const PRESETS: ReadonlyArray<Exclude<ScenarioPresetKey, 'custom'>> = ['calm', 'moderate', 'strict'];

export function ScenarioPresetPicker({ presetKey, onApply }: Props) {
  const t = useTranslations('simulators.scenario.presets');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-neutral-600">{t('label')}</span>
      {PRESETS.map((key) => {
        const active = presetKey === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onApply(key)}
            aria-pressed={active}
            className={`inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition ${
              active
                ? 'border-brand-gold-dark bg-brand-gold-soft text-brand-gold-text'
                : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {t(key)}
          </button>
        );
      })}
      {presetKey === 'custom' ? (
        <span className="inline-flex h-9 items-center rounded-lg border border-dashed border-neutral-300 px-3 text-sm font-medium text-neutral-500">
          {t('custom')}
        </span>
      ) : null}
    </div>
  );
}
