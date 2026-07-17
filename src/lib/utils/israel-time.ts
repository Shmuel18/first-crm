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

/**
 * Israel's UTC offset in minutes at a given instant (DST-aware).
 * Resolve it near midday of the target civil day so a DST switch (which
 * happens around 02:00) can't be read off the wrong side of the boundary.
 */
function israelOffsetMinutes(at: Date): number {
  const zoneName = new Intl.DateTimeFormat('en-US', {
    timeZone: ISRAEL_TZ,
    timeZoneName: 'longOffset',
  })
    .formatToParts(at)
    .find((part) => part.type === 'timeZoneName')?.value;
  const match = zoneName?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) throw new Error('Unable to resolve Israel UTC offset');

  const [, sign, hours, minutes] = match;
  return (Number(hours) * 60 + Number(minutes)) * (sign === '+' ? 1 : -1);
}

/**
 * The UTC instant at which the current Israel-local calendar month began.
 *
 * The server runs in UTC, while Israel is UTC+2 or UTC+3 depending on DST.
 * Resolve the offset at the first day of the relevant month so a database
 * range never drops the first hours of the month or includes the prior month.
 */
export function israelMonthStartIso(now: Date = new Date()): string {
  const { year, month } = israelCivil(now);
  const offsetMinutes = israelOffsetMinutes(new Date(Date.UTC(year, month - 1, 1, 12)));
  return new Date(Date.UTC(year, month - 1, 1) - offsetMinutes * 60_000).toISOString();
}

/**
 * "Now" as an Israel wall-clock `datetime-local` string ("2026-07-19T08:00").
 * Used as the min of a scheduling picker. Safe on both runtimes (Intl resolves
 * Asia/Jerusalem regardless of the ambient zone), but callers rendering it into
 * markup should set it after mount — server and client can straddle a minute
 * tick and hydrate-mismatch.
 */
export function israelWallClockNow(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ISRAEL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00';
  const hour = String(Number(get('hour')) % 24).padStart(2, '0');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

/**
 * Convert an Israel wall-clock `datetime-local` string ("2026-07-19T08:00")
 * to its UTC instant. The office reads "08:00" as 08:00 IN ISRAEL, so the
 * value is interpreted in Asia/Jerusalem — NOT in the runtime's timezone
 * (Vercel is UTC) nor the browser's (an advisor abroad still means office
 * time). Returns null on a malformed string.
 */
export function israelWallClockToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number) as [
    number, number, number, number, number,
  ];
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const offsetMinutes = israelOffsetMinutes(new Date(Date.UTC(year, month - 1, day, 12)));
  const instant = new Date(Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes * 60_000);
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}
