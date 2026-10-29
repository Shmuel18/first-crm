'use client';

import { useTranslations } from 'next-intl';

import { hebrewCellLabel } from '../domain/hebrew-date';
import type { CalendarItem } from '../types';

import { CalendarChip } from './calendar-chip';

/** Chips shown per cell before collapsing into "+N more". */
const MAX_PER_CELL = 3;

type Props = {
  days: ReadonlyArray<string>;
  /** Month being shown ("YYYY-MM") — days outside it are dimmed. */
  month: string;
  today: string;
  byDay: ReadonlyMap<string, CalendarItem[]>;
  onOpenItem: (item: CalendarItem) => void;
  onOpenDay: (day: string) => void;
  onCreate: (day: string) => void;
  onDropItem: (itemKey: string, day: string) => void;
};

/** Six-week month grid; click an empty cell to add an event, drop a chip to move it. */
export function CalendarMonth({ days, month, today, byDay, onOpenItem, onOpenDay, onCreate, onDropItem }: Props) {
  const t = useTranslations('calendar');
  const weekdays = t.raw('weekdaysShort') as string[]; // fixed-length array in the catalog

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50 text-center text-[11px] font-medium text-neutral-500">
        {weekdays.map((w) => (
          <div key={w} className="py-1.5">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((day) => {
          const items = byDay.get(day) ?? [];
          const extra = items.length - MAX_PER_CELL;
          const isToday = day === today;
          const inMonth = day.startsWith(month);
          return (
            <div
              key={day}
              role="gridcell"
              onClick={() => onCreate(day)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const key = e.dataTransfer.getData('text/calendar-item');
                if (key) onDropItem(key, day);
              }}
              aria-current={isToday ? 'date' : undefined}
              className={`min-h-24 cursor-pointer space-y-0.5 border-b border-e border-neutral-100 p-1 transition ${
                isToday
                  ? 'bg-brand-gold-soft ring-2 ring-inset ring-brand-gold'
                  : inMonth
                    ? 'hover:bg-neutral-50'
                    : 'bg-neutral-50/60 text-neutral-400 hover:bg-neutral-50'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDay(day);
                  }}
                  className={`flex size-6 items-center justify-center rounded-full text-xs tabular-nums hover:bg-neutral-200 ${
                    isToday ? 'bg-brand-black font-semibold text-white hover:bg-brand-black' : ''
                  }`}
                >
                  {Number(day.slice(8, 10))}
                </button>
                <span
                  lang="he"
                  className={`truncate text-[11px] ${isToday ? 'font-semibold text-brand-gold-text' : inMonth ? 'text-neutral-400' : 'text-neutral-300'}`}
                >
                  {hebrewCellLabel(day)}
                </span>
              </div>
              {items.slice(0, MAX_PER_CELL).map((item) => (
                <CalendarChip key={item.key} item={item} onOpen={onOpenItem} compact />
              ))}
              {extra > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDay(day);
                  }}
                  className="w-full rounded px-1.5 text-start text-[11px] text-neutral-500 hover:bg-neutral-100"
                >
                  {t('more', { count: extra })}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
