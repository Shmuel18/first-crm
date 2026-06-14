/**
 * Israel-local civil date/time, independent of the ambient runtime timezone.
 *
 * Server Components run in UTC (Vercel) while the office is in Israel
 * (UTC+2 winter / UTC+3 summer), so `new Date().getHours()` / a default
 * `new Date()` "today" disagree with what the user sees. Deriving the civil
 * parts in `Asia/Jerusalem` via Intl makes server and client agree, and lets
 * callers do calendar math (e.g. +7 days) that is DST-safe.
 */
const ISRAEL_TZ = 'Asia/Jerusalem';

export type IsraelCivil = {
  /** Full year, e.g. 2026. */
  year: number;
  /** 1-12. */
  month: number;
  /** 1-31. */
  day: number;
  /** 0-23 (local wall-clock hour in Israel). */
  hour: number;
};

export function israelCivil(now: Date = new Date()): IsraelCivil {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ISRAEL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  // Some engines render midnight as hour "24"; normalize to 0-23.
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
  };
}
