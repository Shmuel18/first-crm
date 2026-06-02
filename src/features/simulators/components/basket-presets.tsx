'use client';

import { Landmark } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { UniformBasketKind } from '../utils/track-factory';

const KINDS: ReadonlyArray<UniformBasketKind> = ['fixed_only', 'thirds', 'halves'];

/**
 * Quick-load the Bank of Israel "uniform baskets" — the standard structures
 * banks must quote for a principal-approval request. Splits the current loan
 * amount into the basket's shares; the advisor then adjusts the rates.
 */
export function BasketPresets({ onLoad }: { onLoad: (kind: UniformBasketKind) => void }) {
  const t = useTranslations('simulators.mix.baskets');

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-gold-soft text-brand-gold-text ring-1 ring-brand-gold/20">
          <Landmark className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-neutral-950">{t('title')}</h2>
          <p className="text-xs text-neutral-500">{t('hint')}</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => onLoad(kind)}
            className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-start transition hover:border-brand-gold/50 hover:bg-brand-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/30"
          >
            <span className="block text-sm font-semibold text-neutral-900">{t(`kinds.${kind}.label`)}</span>
            <span className="mt-0.5 block text-xs text-neutral-500">{t(`kinds.${kind}.desc`)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
