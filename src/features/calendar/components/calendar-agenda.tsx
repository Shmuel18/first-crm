'use client';

import { useTranslations } from 'next-intl';

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
        <li key={day} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <h3
            className={`border-b border-neutral-100 px-3 py-1.5 text-xs font-semibold ${
              day === today ? 'bg-brand-gold-soft text-brand-gold-text' : 'bg-neutral-50 text-neutral-600'
            }`}
          >
            {day === today ? `${t('today')} · ` : ''}
            {weekdays[new Date(`${day}T12:00:00Z`).getUTCDay()]} {Number(day.slice(8, 10))}/{Number(day.slice(5, 7))}
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
