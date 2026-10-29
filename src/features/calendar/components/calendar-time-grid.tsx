'use client';

import { useTranslations } from 'next-intl';

import { hebrewDayMonth } from '../domain/hebrew-date';
import { useIsraelNow } from '../hooks/use-israel-now';
import type { CalendarItem } from '../types';

import { CalendarChip } from './calendar-chip';

/** Office hours on the axis; earlier / later items pin to the edges. */
const FIRST_HOUR = 7;
const LAST_HOUR = 21;
const HOUR_PX = 44;

function minutesFromTop(time: string): number {
  const [h, m] = time.split(':').map(Number);
  const mins = ((h ?? 0) - FIRST_HOUR) * 60 + (m ?? 0);
  return Math.min(Math.max(mins, 0), (LAST_HOUR - FIRST_HOUR) * 60 - 30);
}

/** Pixel offset of the "now" line, or null outside the hours on the axis. */
function nowLineTop(time: string): number | null {
  const [h, m] = time.split(':').map(Number);
  const mins = ((h ?? 0) - FIRST_HOUR) * 60 + (m ?? 0);
  return mins < 0 || mins >= (LAST_HOUR - FIRST_HOUR) * 60 ? null : (mins / 60) * HOUR_PX;
}

type Props = {
  days: ReadonlyArray<string>;
  today: string;
  byDay: ReadonlyMap<string, CalendarItem[]>;
  onOpenItem: (item: CalendarItem) => void;
  onCreate: (day: string, time: string | null) => void;
  onDropItem: (itemKey: string, day: string) => void;
};

/**
 * Week / day view: an "all day" row on top (target dates, tasks without a
 * time, stage changes…) and an hour axis below for timed items.
 */
export function CalendarTimeGrid({ days, today, byDay, onOpenItem, onCreate, onDropItem }: Props) {
  const t = useTranslations('calendar');
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i);
  const weekdays = t.raw('weekdaysShort') as string[]; // fixed-length array in the catalog
  const cols = { gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))` };
  const now = useIsraelNow();
  const nowTop = now && days.includes(now.day) ? nowLineTop(now.time) : null;

  const drop = (day: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const key = e.dataTransfer.getData('text/calendar-item');
    if (key) onDropItem(key, day);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="grid border-b border-neutral-200 bg-neutral-50 text-center text-xs" style={cols}>
        <div />
        {days.map((day) => (
          <div
            key={day}
            aria-current={day === today ? 'date' : undefined}
            className={`py-1.5 ${day === today ? 'bg-brand-gold-soft font-bold text-brand-gold-text' : 'text-neutral-600'}`}
          >
            <div>
              {weekdays[new Date(`${day}T12:00:00Z`).getUTCDay()]} {Number(day.slice(8, 10))}/{Number(day.slice(5, 7))}
            </div>
            <div lang="he" className={`truncate text-[10px] ${day === today ? '' : 'text-neutral-400'}`}>
              {hebrewDayMonth(day)}
            </div>
          </div>
        ))}
      </div>
      <div className="grid border-b border-neutral-200" style={cols}>
        <div className="py-1 text-center text-[10px] text-neutral-400">{t('allDay')}</div>
        {days.map((day) => (
          <div
            key={day}
            onClick={() => onCreate(day, null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={drop(day)}
            className={`min-h-10 cursor-pointer space-y-0.5 border-s border-neutral-100 p-1 ${day === today ? 'bg-brand-gold-soft' : ''}`}
          >
            {(byDay.get(day) ?? []).filter((i) => i.time === null).map((item) => (
              <CalendarChip key={item.key} item={item} onOpen={onOpenItem} compact={days.length > 1} />
            ))}
          </div>
        ))}
      </div>
      <div className="grid max-h-[60vh] overflow-y-auto" style={cols}>
        <div>
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR_PX }} className="pe-1 text-end text-[10px] tabular-nums text-neutral-400" dir="ltr">
              {`${String(h).padStart(2, '0')}:00`}
            </div>
          ))}
        </div>
        {days.map((day) => (
          <div
            key={day}
            onDragOver={(e) => e.preventDefault()}
            onDrop={drop(day)}
            className={`relative border-s border-neutral-100 ${day === today ? 'bg-brand-gold-soft' : ''}`}
            style={{ height: hours.length * HOUR_PX }}
          >
            {hours.map((h) => (
              <button
                key={h}
                type="button"
                aria-label={`${day} ${h}:00`}
                onClick={() => onCreate(day, `${String(h).padStart(2, '0')}:00`)}
                style={{ height: HOUR_PX }}
                className="block w-full border-b border-neutral-50 hover:bg-neutral-50"
              />
            ))}
            {(byDay.get(day) ?? []).filter((i) => i.time !== null).map((item) => (
              <div
                key={item.key}
                className="absolute inset-x-0.5"
                style={{ top: (minutesFromTop(item.time ?? '00:00') / 60) * HOUR_PX }}
              >
                <CalendarChip item={item} onOpen={onOpenItem} compact={days.length > 1} />
              </div>
            ))}
            {nowTop !== null && day === now?.day && (
              <div
                aria-hidden="true"
                title={t('now')}
                className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-brand-gold"
                style={{ top: nowTop }}
              >
                <span className="absolute -start-1 -top-1.25 size-2 rounded-full bg-brand-gold" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
