'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { agorotToNis, formatMoney, formatRatio, nisToAgorot } from '../utils/format';

import type { RepaymentType, TrackInput, TrackResult, TrackType } from '../types';

type Props = {
  tracks: ReadonlyArray<TrackInput>;
  /** Per-track engine results, keyed by trackId, for the inline result columns. */
  summaries?: ReadonlyArray<TrackResult>;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<TrackInput>) => void;
};

const cellInput =
  'h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm shadow-xs outline-none transition focus:border-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/30';

/** Dense, scannable track editor — one row per track, with per-row results inline. */
export function TrackTable({ tracks, summaries = [], onAdd, onRemove, onUpdate }: Props) {
  const t = useTranslations('simulators.mix.tracks');

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-neutral-950">{t('title')}</h2>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-brand-gold/50 px-3 text-sm font-medium text-brand-gold-text hover:bg-brand-gold-soft"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t('add')}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            <tr className="text-xs text-neutral-500">
              <Th>{t('type')}</Th>
              <Th>{t('amount')}</Th>
              <Th>{t('rate')}</Th>
              <Th>{t('term')}</Th>
              <Th>{t('repayment')}</Th>
              <Th>{t('cpiGrace')}</Th>
              <Th align="end">{t('monthly')}</Th>
              <Th align="end">{t('totalCost')}</Th>
              <Th align="end">{t('ratio')}</Th>
              <th className="w-10 border-b border-neutral-100" />
            </tr>
          </thead>
          <tbody>
            {tracks.map((track) => (
              <TrackTableRow
                key={track.id}
                track={track}
                summary={summaries.find((item) => item.trackId === track.id)}
                onRemove={onRemove}
                onUpdate={onUpdate}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-neutral-500">{t('rateNote')}</p>
    </section>
  );
}

function TrackTableRow({
  track,
  summary,
  onRemove,
  onUpdate,
}: {
  track: TrackInput;
  summary?: TrackResult;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<TrackInput>) => void;
}) {
  const t = useTranslations('simulators.mix.tracks');
  const linked = track.type.endsWith('_linked');
  const balloon = track.repayment === 'balloon';

  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <Td>
        <select className={cellInput} value={track.type} onChange={(e) => onUpdate(track.id, { type: parseTrackType(e.target.value) })}>
          {trackTypes.map((type) => (
            <option key={type} value={type}>
              {t(`types.${type}`)}
            </option>
          ))}
        </select>
      </Td>
      <Td>
        <input className={cellInput} inputMode="numeric" value={agorotToNis(track.amount)} onChange={(e) => onUpdate(track.id, { amount: nisToAgorot(e.target.value) })} />
      </Td>
      <Td>
        <input className={cellInput} type="number" step="0.01" value={track.annualRatePct} onChange={(e) => onUpdate(track.id, { annualRatePct: Number(e.target.value) })} />
      </Td>
      <Td>
        <input className={cellInput} type="number" value={track.termMonths} onChange={(e) => onUpdate(track.id, { termMonths: Number(e.target.value) })} />
      </Td>
      <Td>
        <select className={cellInput} value={track.repayment} onChange={(e) => onUpdate(track.id, { repayment: parseRepayment(e.target.value) })}>
          {repayments.map((item) => (
            <option key={item} value={item}>
              {t(`repayments.${item}`)}
            </option>
          ))}
        </select>
      </Td>
      <Td>
        <input
          className={cellInput}
          type="number"
          step="0.01"
          disabled={!linked && !balloon}
          value={linked ? track.cpiAnnualPct ?? 0 : balloon ? track.graceMonths ?? 0 : ''}
          onChange={(e) => onUpdate(track.id, linked ? { cpiAnnualPct: Number(e.target.value) } : { graceMonths: Number(e.target.value) })}
        />
      </Td>
      <Td align="end" className="text-neutral-800">{summary ? formatMoney(summary.firstPayment) : '—'}</Td>
      <Td align="end" className="text-neutral-800">{summary ? formatMoney(summary.totalCost) : '—'}</Td>
      <Td align="end" className="font-semibold text-brand-gold-text">{summary ? formatRatio(summary.costPerShekel) : '—'}</Td>
      <Td>
        <button
          type="button"
          onClick={() => onRemove(track.id)}
          className="flex size-8 items-center justify-center rounded-md text-neutral-400 hover:bg-red-50 hover:text-red-600"
          aria-label={t('remove')}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </Td>
    </tr>
  );
}

function Th({ children, align = 'start' }: { children?: React.ReactNode; align?: 'start' | 'end' }) {
  return <th className={`border-b border-neutral-100 px-2 py-2 font-medium ${align === 'end' ? 'text-end' : 'text-start'}`}>{children}</th>;
}

function Td({ children, align = 'start', className = '' }: { children?: React.ReactNode; align?: 'start' | 'end'; className?: string }) {
  return <td className={`px-2 py-1.5 align-middle tabular-nums ${align === 'end' ? 'text-end' : 'text-start'} ${className}`}>{children}</td>;
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
