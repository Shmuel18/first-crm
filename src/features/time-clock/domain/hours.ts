import type { TimeEntry } from '../types';

/**
 * Minutes worked in one shift. An OPEN shift (no clock_out) is measured up to
 * `nowMs` (pass Date.now() at the call site — the domain stays pure/testable).
 * Guards against clock skew (negative spans → 0).
 */
export function entryMinutes(entry: Pick<TimeEntry, 'clockIn' | 'clockOut'>, nowMs: number): number {
  const start = Date.parse(entry.clockIn);
  const end = entry.clockOut ? Date.parse(entry.clockOut) : nowMs;
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.floor((end - start) / 60_000);
}

/** Total minutes across shifts (open shifts measured to `nowMs`). */
export function totalMinutes(entries: readonly Pick<TimeEntry, 'clockIn' | 'clockOut'>[], nowMs: number): number {
  return entries.reduce((acc, e) => acc + entryMinutes(e, nowMs), 0);
}

/** Minutes → "H:MM" (e.g. 154 → "2:34"). */
export function formatHm(minutes: number): string {
  const safe = Math.max(0, Math.floor(minutes));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

/** The Israel-local calendar day (YYYY-MM-DD) an ISO instant falls on. */
export function israelDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(iso));
}

/** Group shifts by Israel calendar day, newest day first, each with its total. */
export function groupByDay(
  entries: readonly TimeEntry[],
  nowMs: number,
): { day: string; minutes: number; entries: TimeEntry[] }[] {
  const byDay = new Map<string, TimeEntry[]>();
  for (const e of entries) {
    const day = israelDay(e.clockIn);
    const list = byDay.get(day) ?? [];
    list.push(e);
    byDay.set(day, list);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, list]) => ({ day, entries: list, minutes: totalMinutes(list, nowMs) }));
}
