import { israelCivil } from '@/lib/utils/israel-time';

export const TARGET_DATE_FILTER_VALUES = ['overdue', 'week', 'none'] as const;

export type TargetDateFilter = (typeof TARGET_DATE_FILTER_VALUES)[number];

export type TargetDateState = 'none' | 'overdue' | 'soon' | 'future';

function dateOnlyTime(value: string | Date): number {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  }
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return Number.NaN;
  return new Date(year, month - 1, day).getTime();
}

export function getTargetDateState(value: string | null | undefined, now = new Date()): TargetDateState {
  if (!value) return 'none';
  const target = dateOnlyTime(value);
  if (Number.isNaN(target)) return 'none';
  // "Today" anchored to Israel's civil date, not the ambient runtime clock, so a
  // server (UTC) render agrees with the client (Israel) badge (R5-domain-logic-1).
  const { year, month, day } = israelCivil(now);
  const today = new Date(year, month - 1, day).getTime();
  // +7 in CALENDAR days (built via the Date constructor), so a DST transition
  // inside the window can't shift the 7th-day boundary (R5-domain-logic-2).
  const soonCutoff = new Date(year, month - 1, day + 7).getTime();
  if (target < today) return 'overdue';
  if (target <= soonCutoff) return 'soon';
  return 'future';
}

export function matchesTargetDateFilter(
  value: string | null | undefined,
  filter: TargetDateFilter | null,
  now = new Date(),
): boolean {
  if (!filter) return true;
  const state = getTargetDateState(value, now);
  if (filter === 'none') return state === 'none';
  if (filter === 'overdue') return state === 'overdue';
  return state === 'soon';
}

export function compareTargetDates(a: string | null | undefined, b: string | null | undefined): number {
  const aTime = a ? dateOnlyTime(a) : Number.POSITIVE_INFINITY;
  const bTime = b ? dateOnlyTime(b) : Number.POSITIVE_INFINITY;
  if (aTime === bTime) return 0;
  return aTime < bTime ? -1 : 1;
}

/**
 * True only for a real YYYY-MM-DD calendar date. Beyond the format check it
 * rejects roll-over inputs like "2020-13-45" that a bare regex accepts but the
 * JS Date constructor silently rolls into a different valid date — so the
 * server action can return a precise `validation` error instead of leaning on
 * the DB to reject it as a generic failure.
 */
export function isValidTargetDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  );
}
