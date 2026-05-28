'use client';

import { useTranslations } from 'next-intl';

import type { ComparisonBase } from '../hooks/use-mix-comparison';
import type { PropertyKind } from '../types';
import { agorotToNis, nisToAgorot } from '../utils/format';

type Props = {
  title: string;
  subtitle: string;
  base: ComparisonBase;
  propertyKind: PropertyKind;
  onPropertyKindChange: (value: PropertyKind) => void;
  onMoneyChange: (field: 'mortgageAmount' | 'propertyValue' | 'equity', value: number) => void;
  onTermChange: (value: number) => void;
};

const inputClass =
  'h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm shadow-xs outline-none transition focus:border-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/30';

export function LoanBasePanel({ title, subtitle, base, propertyKind, onPropertyKindChange, onMoneyChange, onTermChange }: Props) {
  const t = useTranslations('simulators.mix.inputs');

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-1 font-display text-lg font-semibold text-neutral-950">{title}</h2>
      <p className="mb-4 text-sm text-neutral-500">{subtitle}</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label={t('propertyKind')}>
          <select className={inputClass} value={propertyKind} onChange={(e) => onPropertyKindChange(parsePropertyKind(e.target.value))}>
            <option value="first_home">{t('propertyKinds.first_home')}</option>
            <option value="replacement">{t('propertyKinds.replacement')}</option>
            <option value="investment">{t('propertyKinds.investment')}</option>
          </select>
        </Field>
        <MoneyField label={t('propertyValue')} value={base.propertyValue} onChange={(v) => onMoneyChange('propertyValue', v)} />
        <MoneyField label={t('equity')} value={base.equity} onChange={(v) => onMoneyChange('equity', v)} />
        <MoneyField label={t('mortgageAmount')} value={base.mortgageAmount} onChange={(v) => onMoneyChange('mortgageAmount', v)} />
        <Field label={t('termMonths')}>
          <input className={inputClass} type="number" min={1} max={480} value={base.defaultTermMonths} onChange={(e) => onTermChange(Number(e.target.value))} />
        </Field>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
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
