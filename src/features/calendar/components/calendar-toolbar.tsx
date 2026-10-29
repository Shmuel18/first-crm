'use client';

import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';

import { hebrewTitle } from '../domain/hebrew-title';
import { CALENDAR_VIEWS, type CalendarView } from '../types';

type Props = {
  view: CalendarView;
  anchor: string;
  query: string;
  onQuery: (q: string) => void;
  onView: (view: CalendarView) => void;
  onStep: (step: -1 | 1) => void;
  onToday: () => void;
  onNewEvent: () => void;
  /** The layers / advisors filter popover (rendered by the parent). */
  filters: React.ReactNode;
};

/** Title + navigation + view switch + search + "new event". */
export function CalendarToolbar({ view, anchor, query, onQuery, onView, onStep, onToday, onNewEvent, filters }: Props) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const title = new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    month: 'long',
    year: 'numeric',
    ...(view === 'day' ? { day: 'numeric', weekday: 'long' } : {}),
    timeZone: 'UTC',
  }).format(new Date(`${anchor}T12:00:00Z`));
  const navBtn =
    'flex size-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600 transition hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        {/* Chevrons follow reading direction: in RTL "previous" points right. */}
        <button type="button" onClick={() => onStep(-1)} aria-label={t('previous')} className={navBtn}>
          <ChevronRight className="size-4 ltr:rotate-180" aria-hidden="true" />
        </button>
        <button type="button" onClick={onToday} className="h-8 rounded-md border border-neutral-200 bg-white px-3 text-xs text-neutral-700 hover:border-neutral-400">
          {t('today')}
        </button>
        <button type="button" onClick={() => onStep(1)} aria-label={t('next')} className={navBtn}>
          <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden="true" />
        </button>
      </div>
      <h2 className="min-w-32 font-display text-lg font-semibold text-neutral-900">
        {title}
        <span className="text-neutral-300" aria-hidden="true"> · </span>
        <span lang="he" dir="rtl" className="text-base font-medium text-brand-gold-text">
          {hebrewTitle(view, anchor)}
        </span>
      </h2>

      <div className="ms-auto flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            className="h-8 w-40 ps-7 text-xs"
          />
        </div>
        {filters}
        <div role="tablist" aria-label={t('viewLabel')} className="flex rounded-md border border-neutral-200 bg-white p-0.5">
          {CALENDAR_VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={v === view}
              onClick={() => onView(v)}
              className={`rounded px-2.5 py-1 text-xs transition ${
                v === view ? 'bg-brand-black text-white' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {t(`views.${v}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onNewEvent}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-brand-gold px-3 text-xs font-medium text-brand-black transition hover:bg-brand-gold-hover"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {t('newEvent')}
        </button>
      </div>
    </div>
  );
}
