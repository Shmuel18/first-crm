'use client';

import { Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { CompositionFamily, CompositionSlice } from '../domain/mix-composition';
import { formatMoney, formatPct } from '../utils/format';

type Props = { slices: ReadonlyArray<CompositionSlice> };

/** Brand-aligned hues, reused from the shared simulator chart palette. */
const FAMILY_COLOR: Record<CompositionFamily, string> = {
  fixed: 'var(--color-sim-series-1)',
  prime: 'var(--color-sim-series-3)',
  variable: 'var(--color-sim-series-2)',
  eligibility: 'var(--color-sim-series-4)',
};

export function MixCompositionBar({ slices }: Props) {
  const t = useTranslations('simulators.mix.composition');

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-gold-soft text-brand-gold-text ring-1 ring-brand-gold/20">
          <Layers className="size-4" aria-hidden="true" />
        </span>
        <h2 className="font-display text-lg font-semibold text-neutral-950">{t('title')}</h2>
      </div>
      {slices.length === 0 ? (
        <p className="text-sm text-neutral-500">{t('empty')}</p>
      ) : (
        <>
          <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-neutral-100">
            {slices.map((slice) => (
              <div
                key={slice.family}
                className="h-full"
                style={{ width: `${slice.share * 100}%`, backgroundColor: FAMILY_COLOR[slice.family] }}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {slices.map((slice) => (
              <li key={slice.family} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: FAMILY_COLOR[slice.family] }} aria-hidden="true" />
                <span className="font-medium text-neutral-700">{t(`families.${slice.family}`)}</span>
                <span className="font-semibold text-neutral-950">{formatPct(slice.share * 100)}</span>
                <span className="text-neutral-400">({formatMoney(slice.amount)})</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
