import { israelCivil, israelDayStartIso } from '@/lib/utils/israel-time';

/** A half-open [from, to) instant range covering one calendar month. */
export type MonthRange = { fromISO: string; toISO: string };

/**
 * The `offset`-th Israel calendar month relative to "now" (0 = current month,
 * -1 = previous month), as a half-open [from, to) instant range.
 *
 * Israel-local on purpose: the office's month must not shift because the
 * server runs in UTC or because someone opens the clock from abroad. Boundaries
 * go through israelDayStartIso, so a DST switch inside the month is safe.
 */
export function israelMonthRange(nowMs: number, offset: number): MonthRange {
  const { year, month } = israelCivil(new Date(nowMs));
  // Date.UTC normalizes month overflow/underflow (e.g. month 13 → next January).
  const start = new Date(Date.UTC(year, month - 1 + offset, 1));
  const end = new Date(Date.UTC(year, month + offset, 1));
  return {
    fromISO: israelDayStartIso(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
    toISO: israelDayStartIso(end.getUTCFullYear(), end.getUTCMonth() + 1, 1),
  };
}
