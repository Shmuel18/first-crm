import type { CalendarView } from '../types';

import { addDays, rangeFor, shiftAnchor } from './calendar-range';
import { hebrewDate, hebrewMonthSpan } from './hebrew-date';

/** The toolbar's Hebrew-calendar subtitle for what a view shows around `anchor`. */
export function hebrewTitle(view: CalendarView, anchor: string): string {
  if (view === 'day') {
    const h = hebrewDate(anchor);
    return `${h.day} ${h.month} ${h.year}`;
  }
  if (view === 'month') {
    const first = `${anchor.slice(0, 7)}-01`;
    return hebrewMonthSpan(first, addDays(shiftAnchor('month', first, 1), -1));
  }
  const { days } = rangeFor(view, anchor);
  return hebrewMonthSpan(days[0] ?? anchor, days[days.length - 1] ?? anchor);
}
