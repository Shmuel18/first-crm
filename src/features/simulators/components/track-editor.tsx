'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { agorotToNis, formatMoney, formatRatio, nisToAgorot } from '../utils/format';
import type { RepaymentType, TrackInput, TrackResult, TrackType } from '../types';

type Props = {
  tracks: ReadonlyArray<TrackInput>;
  /** Per-track engine results, keyed by trackId, to show the cost footer.
   *  Omitted on the comparison/scenario editors, which surface costs elsewhere. */
  summaries?: ReadonlyArray<TrackResult>;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<TrackInput>) => void;
};

const inputClass =
  'h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm shadow-xs outline-none transition focus:border-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/30';

export function TrackEditor({ tracks, summaries = [], onAdd, onRemove, onUpdate }: Props) {
  const t = useTranslations('simulators.mix.tracks');

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-neutral-950">{t('title')}</h2>
        <button type="button" onClick={onAdd} className="inline-flex h-9 items-center gap-2 rounded-lg border border-brand-gold/50 px-3 text-sm font-medium text-brand-gold-text hover:bg-brand-gold-soft">
          <Plus className="size-4" aria-hidden="true" />
          {t('add')}
        </button>
      </div>
      <p className="mb-3 text-xs text-neutral-500">{t('rateNote')}</p>
      <div className="space-y-3">
        {tracks.map((track) => (
          <TrackRow
            key={track.id}
            track={track}
            summary={summaries.find((item) => item.trackId === track.id)}
            onRemove={onRemove}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </section>
  );
}

function TrackRow({ track, summary, onRemove, onUpdate }: { track: TrackInput; summary?: TrackResult; onRemove: (id: string) => void; onUpdate: (id: string, patch: Partial<TrackInput>) => void }) {
  const t = useTranslations('simulators.mix.tracks');
  const linked = track.type.endsWith('_linked');
  const balloon = track.repayment === 'balloon';

  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_0.8fr_0.8fr_1fr_0.8fr_2.5rem]">
        <SelectField label={t('type')} value={track.type} onChange={(value) => onUpdate(track.id, { type: parseTrackType(value) })}>
          {trackTypes.map((type) => <option key={type} value={type}>{t(`types.${type}`)}</option>)}
        </SelectField>
        <InputField label={t('amount')} value={agorotToNis(track.amount)} onChange={(value) => onUpdate(track.id, { amount: nisToAgorot(value) })} />
        <InputField label={t('rate')} type="number" step="0.01" value={track.annualRatePct} onChange={(value) => onUpdate(track.id, { annualRatePct: Number(value) })} />
        <InputField label={t('term')} type="number" value={track.termMonths} onChange={(value) => onUpdate(track.id, { termMonths: Number(value) })} />
        <SelectField label={t('repayment')} value={track.repayment} onChange={(value) => onUpdate(track.id, { repayment: parseRepayment(value) })}>
          {repayments.map((item) => <option key={item} value={item}>{t(`repayments.${item}`)}</option>)}
        </SelectField>
        <InputField label={linked ? t('cpi') : balloon ? t('grace') : t('extra')} type="number" step="0.01" disabled={!linked && !balloon} value={linked ? track.cpiAnnualPct ?? 0 : balloon ? track.graceMonths ?? 0 : ''} onChange={(value) => onUpdate(track.id, linked ? { cpiAnnualPct: Number(value) } : { graceMonths: Number(value) })} />
        <div className="flex items-end">
          <button type="button" onClick={() => onRemove(track.id)} className="flex size-9 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600" aria-label={t('remove')}>
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {summary && (
        <dl className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 border-t border-neutral-100 pt-2.5 text-xs">
          <div className="flex items-center gap-1.5">
            <dt className="text-neutral-500">{t('monthly')}</dt>
            <dd className="font-semibold tabular-nums text-neutral-800">{formatMoney(summary.firstPayment)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-neutral-500">{t('totalCost')}</dt>
            <dd className="font-semibold tabular-nums text-neutral-800">{formatMoney(summary.totalCost)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-neutral-500">{t('ratio')}</dt>
            <dd className="font-semibold tabular-nums text-brand-gold-text">{formatRatio(summary.costPerShekel)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function InputField({ label, value, onChange, type = 'text', step, disabled }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; step?: string; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-600">{label}</span>
      <input className={inputClass} type={type} step={step} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-600">{label}</span>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
    </label>
  );
}

const trackTypes: readonly TrackType[] = ['fixed_unlinked', 'fixed_linked', 'prime', 'variable_unlinked', 'variable_linked', 'eligibility'];
const repayments: readonly RepaymentType[] = ['spitzer', 'equal_principal', 'balloon'];

function parseTrackType(value: string): TrackType {
  switch (value) {
    case 'fixed_linked':
    case 'prime':
    case 'variable_unlinked':
    case 'variable_linked':
    case 'eligibility':
      return value;
    default:
      return 'fixed_unlinked';
  }
}

function parseRepayment(value: string): RepaymentType {
  return value === 'equal_principal' || value === 'balloon' ? value : 'spitzer';
}
