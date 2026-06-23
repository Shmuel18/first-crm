'use client';

import { useTranslations } from 'next-intl';

import { agorotToNis, nisToAgorot } from '../utils/format';
import { NumberCell } from './number-cell';

import type { MixInput, PropertyKind } from '../types';

type Props = {
  propertyKind: PropertyKind;
  mix: MixInput;
  onPropertyKindChange: (value: PropertyKind) => void;
  onMoneyChange: (field: 'mortgageAmount' | 'propertyValue' | 'equity', value: number) => void;
  onTermChange: (value: number) => void;
};

const inputClass =
  'h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm shadow-xs outline-none transition focus:border-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/30';

/** Compact single-row loan inputs (the "operational bar"), replacing the tall form card. */
export function MixInputsBar({ propertyKind, mix, onPropertyKindChange, onMoneyChange, onTermChange }: Props) {
  const t = useTranslations('simulators.mix.inputs');

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
          <NumberCell className={inputClass} ariaLabel={t('termMonths')} value={mix.defaultTermMonths} onChange={onTermChange} />
        </Field>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-600">{label}</span>
      {children}
    </label>
  );
}

function MoneyField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <Field label={label}>
      <NumberCell className={inputClass} ariaLabel={label} value={agorotToNis(value)} onChange={(nis) => onChange(nisToAgorot(String(nis)))} />
    </Field>
  );
}

function parsePropertyKind(value: string): PropertyKind {
  return value === 'replacement' || value === 'investment' ? value : 'first_home';
}
