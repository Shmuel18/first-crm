export const TARGET_DATE_FILTER_VALUES = ['overdue', 'week', 'none'] as const;

export type TargetDateFilter = (typeof TARGET_DATE_FILTER_VALUES)[number];

export type TargetDateState = 'none' | 'overdue' | 'soon' | 'future';

const DAY_MS = 24 * 60 * 60 * 1000;

function dateOnlyTime(value: string | Date): number {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  }
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return Number.NaN;
  return new Date(year, month - 1, day).getTime();
}

function todayTime(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export function getTargetDateState(value: string | null | undefined, now = new Date()): TargetDateState {
  if (!value) return 'none';
  const target = dateOnlyTime(value);
  if (Number.isNaN(target)) return 'none';
  const today = todayTime(now);
  if (target < today) return 'overdue';
  if (target <= today + 7 * DAY_MS) return 'soon';
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
