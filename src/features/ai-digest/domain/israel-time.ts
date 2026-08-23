/**
 * Israel wall-clock helpers for the digest scheduler. Subscriptions store an
 * Israel hour (0-23); the hourly cron runs in UTC and converts via
 * Intl.DateTimeFormat with an explicit zone — DST-safe with no offset math.
 * Pure: both take the instant as input (no Date.now() inside) so they're
 * trivially testable.
 */

/** The current hour (0-23) on an Israel wall clock, for a given instant. */
export function israelHour(instant: Date): number {
  const text = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
  return Number.parseInt(text, 10);
}

/** The Israel calendar date (YYYY-MM-DD) for a given instant. */
export function israelDateString(instant: Date): string {
  // en-CA formats as YYYY-MM-DD directly.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}
