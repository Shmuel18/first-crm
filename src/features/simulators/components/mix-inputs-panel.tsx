'use client';

import { useTranslations } from 'next-intl';

import { agorotToNis, nisToAgorot } from '../utils/format';
import type { MixInput, PropertyKind } from '../types';

type Props = {
  title: string;
  advisorConclusion: string;
  propertyKind: PropertyKind;
  mix: MixInput;
  onTitleChange: (value: string) => void;
  onConclusionChange: (value: string) => void;
  onPropertyKindChange: (value: PropertyKind) => void;
  onMoneyChange: (field: 'mortgageAmount' | 'propertyValue' | 'equity', value: number) => void;
  onTermChange: (value: number) => void;
};

const inputClass =
  'h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm shadow-xs outline-none transition focus:border-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/30';

export function MixInputsPanel({
  title,
  advisorConclusion,
  propertyKind,
  mix,
  onTitleChange,
  onConclusionChange,
  onPropertyKindChange,
  onMoneyChange,
  onTermChange,
}: Props) {
  const t = useTranslations('simulators.mix.inputs');

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-4 font-display text-lg font-semibold text-neutral-950">{t('title')}</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label={t('scenarioTitle')}>
          <input className={inputClass} value={title} onChange={(e) => onTitleChange(e.target.value)} />
        </Field>
        <Field label={t('propertyKind')}>
          <select className={inputClass} value={propertyKind} onChange={(e) => onPropertyKindChange(parsePropertyKind(e.target.value))}>
            <option value="first_home">{t('propertyKinds.first_home')}</option>
            <option value="replacement">{t('propertyKinds.replacement')}</option>
            <option value="investment">{t('propertyKinds.investment')}</option>
          </select>
        </Field>
        <MoneyField label={t('propertyValue')} value={mix.propertyValue} onChange={(v) => onMoneyChange('propertyValue', v)} />
        <MoneyField label={t('equity')} value={mix.equity} onChange={(v) => onMoneyChange('equity', v)} />
        <MoneyField label={t('mortgageAmount')} value={mix.mortgageAmount} onChange={(v) => onMoneyChange('mortgageAmount', v)} />
        <Field label={t('termMonths')}>
          <input className={inputClass} type="number" min={1} max={480} value={mix.defaultTermMonths} onChange={(e) => onTermChange(Number(e.target.value))} />
        </Field>
      </div>
      <Field label={t('advisorConclusion')} className="mt-4">
        <textarea className={`${inputClass} min-h-24 py-2`} value={advisorConclusion} onChange={(e) => onConclusionChange(e.target.value)} />
      </Field>
    </section>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

function MoneyField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <Field label={label}>
      <input className={inputClass} inputMode="numeric" value={agorotToNis(value)} onChange={(e) => onChange(nisToAgorot(e.target.value))} />
    </Field>
  );
}

function parsePropertyKind(value: string): PropertyKind {
  return value === 'replacement' || value === 'investment' ? value : 'first_home';
}
