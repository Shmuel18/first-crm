'use client';

import { useState, useTransition } from 'react';

import { Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { updateRegulatoryThresholdsAction } from '../../actions/update-regulatory-thresholds';
import { NumberCell } from '../number-cell';

import type { PropertyKind, RegulatoryThresholds } from '../../types';

type Props = { thresholds: RegulatoryThresholds };

const propertyKinds: readonly PropertyKind[] = ['first_home', 'replacement', 'investment'];
const inputClass =
  'h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm shadow-xs outline-none transition focus:border-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/30';

export function RegulatoryThresholdsForm({ thresholds }: Props) {
  const t = useTranslations('settings.simulators');
  const tc = useTranslations('common');
  const [draft, setDraft] = useState(thresholds);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const result = await updateRegulatoryThresholdsAction(draft);
      if (result.ok) toast.success(t('saved'));
      else toast.error(t(`errors.${result.error}`));
    });
  };

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <header className="mb-5">
        <h2 className="font-display text-xl font-semibold text-neutral-950">{t('title')}</h2>
        <p className="mt-1 text-sm text-neutral-500">{t('subtitle')}</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <fieldset className="rounded-lg border border-neutral-100 p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-800">{t('ltvTitle')}</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {propertyKinds.map((kind) => (
              <PercentField
                key={kind}
                label={t(`propertyKinds.${kind}`)}
                value={draft.maxLtvPct[kind]}
                onChange={(value) => setDraft((d) => ({ ...d, maxLtvPct: { ...d.maxLtvPct, [kind]: value } }))}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-neutral-100 p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-800">{t('mixRulesTitle')}</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <PercentField label={t('minFixedPct')} value={draft.minFixedPct} onChange={(value) => setDraft((d) => ({ ...d, minFixedPct: value }))} />
            <PercentField label={t('maxPrimePct')} value={draft.maxPrimePct} onChange={(value) => setDraft((d) => ({ ...d, maxPrimePct: value }))} />
            <PercentField label={t('maxEqualPrincipalPct')} value={draft.maxEqualPrincipalPct} onChange={(value) => setDraft((d) => ({ ...d, maxEqualPrincipalPct: value }))} />
            <NumberField label={t('maxTermMonths')} value={draft.maxTermMonths} onChange={(value) => setDraft((d) => ({ ...d, maxTermMonths: value }))} />
          </div>
        </fieldset>
      </div>

      <div className="mt-6 flex justify-start border-t border-neutral-100 pt-4">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="btn-gold inline-flex h-10 items-center gap-2 rounded-lg px-4 disabled:pointer-events-none disabled:opacity-50"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          {isPending ? tc('saving') : tc('save')}
        </button>
      </div>
    </section>
  );
}

function PercentField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <NumberField label={`${label} (%)`} value={value} onChange={onChange} />;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-neutral-700">{label}</span>
      <NumberCell className={inputClass} ariaLabel={label} decimal value={value} onChange={onChange} />
    </label>
  );
}
