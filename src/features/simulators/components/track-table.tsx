'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { agorotToNis, formatMoney, formatRatio, nisToAgorot } from '../utils/format';
import { NumberCell } from './number-cell';

import type { ReactNode } from 'react';
import type { RepaymentType, TrackInput, TrackResult, TrackType } from '../types';

type Props = {
  tracks: ReadonlyArray<TrackInput>;
  /** Per-track engine results, keyed by trackId. When omitted (comparison /
   *  scenario editors, which surface costs elsewhere) the result columns are
   *  hidden and only the editable columns show. */
  summaries?: ReadonlyArray<TrackResult>;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<TrackInput>) => void;
};

// 40px tap target on phones, dense 32px from sm up (where the table is shown).
const cellInput =
  'h-10 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm shadow-xs outline-none transition focus:border-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/30 sm:h-8';

type FieldKey = 'type' | 'amount' | 'rate' | 'term' | 'repayment' | 'cpiGrace';
type FieldDef = { key: FieldKey; render: (track: TrackInput) => ReactNode };

/**
 * Dense, scannable track editor. From `sm` up it's a wide horizontal table; on
 * phones it restacks to one labeled card per track (the table would otherwise
 * force horizontal scroll and a fiddly, cramped editing surface). Both layouts
 * render from the SAME field definitions, so the controls never diverge.
 */
export function TrackTable({ tracks, summaries = [], onAdd, onRemove, onUpdate }: Props) {
  const t = useTranslations('simulators.mix.tracks');
  const showResults = summaries.length > 0;

  const fields: ReadonlyArray<FieldDef> = [
    {
      key: 'type',
      render: (track) => (
        <select className={cellInput} value={track.type} onChange={(e) => onUpdate(track.id, { type: parseTrackType(e.target.value) })}>
          {trackTypes.map((type) => (
            <option key={type} value={type}>
              {t(`types.${type}`)}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'amount',
      render: (track) => (
        <NumberCell className={cellInput} ariaLabel={t('amount')} value={agorotToNis(track.amount)} onChange={(nis) => onUpdate(track.id, { amount: nisToAgorot(String(nis)) })} />
      ),
    },
    {
      key: 'rate',
      render: (track) => (
        <NumberCell className={cellInput} ariaLabel={t('rate')} decimal value={track.annualRatePct} onChange={(rate) => onUpdate(track.id, { annualRatePct: rate })} />
      ),
    },
    {
      key: 'term',
      render: (track) => (
        <NumberCell className={cellInput} ariaLabel={t('term')} value={track.termMonths} onChange={(term) => onUpdate(track.id, { termMonths: term })} />
      ),
    },
    {
      key: 'repayment',
      render: (track) => (
        <select className={cellInput} value={track.repayment} onChange={(e) => onUpdate(track.id, { repayment: parseRepayment(e.target.value) })}>
          {repayments.map((item) => (
            <option key={item} value={item}>
              {t(`repayments.${item}`)}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'cpiGrace',
      render: (track) => {
        const linked = track.type.endsWith('_linked');
        const balloon = track.repayment === 'balloon';
        const disabled = !linked && !balloon;
        return (
          <NumberCell
            className={cellInput}
            ariaLabel={t('cpiGrace')}
            decimal={linked}
            disabled={disabled}
            value={disabled ? 0 : linked ? track.cpiAnnualPct ?? 0 : track.graceMonths ?? 0}
            onChange={(n) => onUpdate(track.id, linked ? { cpiAnnualPct: n } : { graceMonths: n })}
          />
        );
      },
    },
  ];

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-neutral-950">{t('title')}</h2>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-brand-gold/50 px-3 text-sm font-medium text-brand-gold-text hover:bg-brand-gold-soft sm:h-9"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t('add')}
        </button>
      </div>

      {/* Phones: one labeled card per track. */}
      <div className="space-y-3 sm:hidden">
        {tracks.map((track) => (
          <TrackCard key={track.id} track={track} fields={fields} summary={summaries.find((s) => s.trackId === track.id)} showResults={showResults} onRemove={onRemove} />
        ))}
      </div>

      {/* sm and up: the dense table. */}
      <div className="hidden overflow-x-auto sm:block">
        <table className={`w-full border-collapse text-sm ${showResults ? 'min-w-[52rem]' : 'min-w-[34rem]'}`}>
          <thead>
            <tr className="text-xs text-neutral-500">
              {fields.map((field) => (
                <Th key={field.key}>{t(field.key)}</Th>
              ))}
              {showResults && (
                <>
                  <Th align="end">{t('monthly')}</Th>
                  <Th align="end">{t('totalCost')}</Th>
                  <Th align="end">{t('ratio')}</Th>
                </>
              )}
              <th className="w-10 border-b border-neutral-100" />
            </tr>
          </thead>
          <tbody>
            {tracks.map((track) => (
              <TrackTableRow key={track.id} track={track} fields={fields} summary={summaries.find((s) => s.trackId === track.id)} showResults={showResults} onRemove={onRemove} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-neutral-500">{t('rateNote')}</p>
    </section>
  );
}

type RowProps = {
  track: TrackInput;
  fields: ReadonlyArray<FieldDef>;
  summary?: TrackResult;
  showResults: boolean;
  onRemove: (id: string) => void;
};

function TrackTableRow({ track, fields, summary, showResults, onRemove }: RowProps) {
  const t = useTranslations('simulators.mix.tracks');
  return (
    <tr className="border-b border-neutral-100 last:border-0">
      {fields.map((field) => (
        <Td key={field.key}>{field.render(track)}</Td>
      ))}
      {showResults && (
        <>
          <Td align="end" className="text-neutral-800">{summary ? formatMoney(summary.firstPayment) : '—'}</Td>
          <Td align="end" className="text-neutral-800">{summary ? formatMoney(summary.totalCost) : '—'}</Td>
          <Td align="end" className="font-semibold text-brand-gold-text">{summary ? formatRatio(summary.costPerShekel) : '—'}</Td>
        </>
      )}
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

function TrackCard({ track, fields, summary, showResults, onRemove }: RowProps) {
  const t = useTranslations('simulators.mix.tracks');
  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <div className="space-y-2.5">
        {fields.map((field) => (
          <div key={field.key} className="flex items-center justify-between gap-3">
            <span className="text-xs text-neutral-500">{t(field.key)}</span>
            <div className="w-40 shrink-0">{field.render(track)}</div>
          </div>
        ))}
      </div>
      {showResults && (
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-3 text-center">
          <ResultCell label={t('monthly')} value={summary ? formatMoney(summary.firstPayment) : '—'} />
          <ResultCell label={t('totalCost')} value={summary ? formatMoney(summary.totalCost) : '—'} />
          <ResultCell label={t('ratio')} value={summary ? formatRatio(summary.costPerShekel) : '—'} accent />
        </dl>
      )}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => onRemove(track.id)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-neutral-500 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {t('remove')}
        </button>
      </div>
    </div>
  );
}

function ResultCell({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] text-neutral-500">{label}</dt>
      <dd className={`truncate text-sm font-semibold tabular-nums ${accent ? 'text-brand-gold-text' : 'text-neutral-800'}`}>{value}</dd>
    </div>
  );
}

function Th({ children, align = 'start' }: { children?: ReactNode; align?: 'start' | 'end' }) {
  return <th className={`border-b border-neutral-100 px-2 py-2 font-medium ${align === 'end' ? 'text-end' : 'text-start'}`}>{children}</th>;
}

function Td({ children, align = 'start', className = '' }: { children?: ReactNode; align?: 'start' | 'end'; className?: string }) {
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
