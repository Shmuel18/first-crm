import type { CalendarView } from '../types';

/** YYYY-MM-DD → its UTC-noon Date (noon keeps DST shifts off the date). */
function toDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12));
}

function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Add whole days to a YYYY-MM-DD. */
export function addDays(day: string, n: number): string {
  const d = toDate(day);
  d.setUTCDate(d.getUTCDate() + n);
  return toDay(d);
}

/** True for a real YYYY-MM-DD. */
export function isCalendarDay(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toDay(toDate(value)) === value;
}

/** Sunday of the week containing `day` (Israeli weeks start on Sunday). */
function weekStart(day: string): string {
  return addDays(day, -toDate(day).getUTCDay());
}

export type CalendarRange = {
  /** First visible day (inclusive). */
  from: string;
  /** Day after the last visible day (exclusive). */
  to: string;
  /** Every visible day in order — a month view is always 6 full weeks. */
  days: string[];
};

/** The days a view shows around its anchor day. Agenda = the next 30 days. */
export function rangeFor(view: CalendarView, anchor: string): CalendarRange {
  let from: string;
  let length: number;
  if (view === 'month') {
    from = weekStart(`${anchor.slice(0, 7)}-01`);
    length = 42;
  } else if (view === 'week') {
    from = weekStart(anchor);
    length = 7;
  } else if (view === 'day') {
    from = anchor;
    length = 1;
  } else {
    from = anchor;
    length = 30;
  }
  const days = Array.from({ length }, (_, i) => addDays(from, i));
  return { from, to: addDays(from, length), days };
}

/** The anchor one step back / forward for the view's arrows. */
export function shiftAnchor(view: CalendarView, anchor: string, step: -1 | 1): string {
  if (view === 'month') {
    const d = toDate(`${anchor.slice(0, 7)}-01`);
    d.setUTCMonth(d.getUTCMonth() + step);
    return toDay(d);
  }
  return addDays(anchor, step * (view === 'week' ? 7 : view === 'day' ? 1 : 30));
}
