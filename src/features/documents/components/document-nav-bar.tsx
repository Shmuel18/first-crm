'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { SiblingNav } from '../domain/sibling-nav';

type Props = {
  nav: SiblingNav;
  onPrev: () => void;
  onNext: () => void;
};

/** "‹ document 3 of 8 ›" — steps through the folder the preview was opened from. */
export function DocumentNavBar({ nav, onPrev, onNext }: Props) {
  const t = useTranslations('documents.previewModal');
  const buttonClass =
    'flex size-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40';

  return (
    <div className="flex items-center gap-2 text-xs text-neutral-600">
      <button
        type="button"
        onClick={onPrev}
        disabled={!nav.prevId}
        aria-label={t('previousDocument')}
        className={buttonClass}
      >
        {/* Chevrons point along the reading direction: in RTL "previous" is to the right. */}
        <ChevronRight className="size-4 ltr:rotate-180" aria-hidden="true" />
      </button>
      <span aria-live="polite" className="min-w-20 text-center tabular-nums">
        {t('documentOf', { position: nav.position, total: nav.total })}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={!nav.nextId}
        aria-label={t('nextDocument')}
        className={buttonClass}
      >
        <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden="true" />
      </button>
    </div>
  );
}
