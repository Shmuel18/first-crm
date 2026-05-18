/**
 * Returns a YYYY-MM-DD stamp suitable for filenames.
 * Locale-independent (no time zone or month name).
 */
export function dateStamp(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}
