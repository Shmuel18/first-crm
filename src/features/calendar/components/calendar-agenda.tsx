'use client';

import { useTranslations } from 'next-intl';

import { hebrewDayMonth } from '../domain/hebrew-date';
import type { CalendarItem } from '../types';

import { CalendarChip } from './calendar-chip';

type Props = {
  days: ReadonlyArray<string>;
  today: string;
  byDay: ReadonlyMap<string, CalendarItem[]>;
  onOpenItem: (item: CalendarItem) => void;
};

/** Chronological list by day — the phone's default view. Empty days are skipped. */
export function CalendarAgenda({ days, today, byDay, onOpenItem }: Props) {
  const t = useTranslations('calendar');
  const weekdays = t.raw('weekdaysLong') as string[]; // fixed-length array in the catalog
  const withItems = days.filter((d) => (byDay.get(d)?.length ?? 0) > 0);

  if (withItems.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-12 text-center text-sm text-neutral-500">
        {t('emptyRange')}
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {withItems.map((day) => (
        <li
          key={day}
          aria-current={day === today ? 'date' : undefined}
          className={`overflow-hidden rounded-xl border bg-white ${
            day === today ? 'border-brand-gold ring-1 ring-brand-gold' : 'border-neutral-200'
          }`}
        >
          <h3
            className={`flex items-baseline justify-between gap-2 border-b px-3 py-1.5 text-xs ${
              day === today
                ? 'border-brand-gold/40 bg-brand-gold-soft font-bold text-brand-gold-text'
                : 'border-neutral-100 bg-neutral-50 font-semibold text-neutral-600'
            }`}
          >
            <span>
              {day === today ? `${t('today')} · ` : ''}
              {weekdays[new Date(`${day}T12:00:00Z`).getUTCDay()]} {Number(day.slice(8, 10))}/{Number(day.slice(5, 7))}
            </span>
            <span lang="he" className={`font-medium ${day === today ? '' : 'text-neutral-400'}`}>
              {hebrewDayMonth(day)}
            </span>
          </h3>
          <div className="space-y-1 p-2">
            {(byDay.get(day) ?? []).map((item) => (
              <CalendarChip key={item.key} item={item} onOpen={onOpenItem} />
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
