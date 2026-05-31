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
