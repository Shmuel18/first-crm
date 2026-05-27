/**
 * Whole-months distance between today and a target end-date string
 * (YYYY-MM-DD format from <input type="date"> or DatePickerPopover).
 *
 * Returns a non-negative integer. A past or invalid date returns 0.
 *
 * Used as the smart default for borrower_obligations.months_remaining:
 * picking an end_date in the table row auto-fills months_remaining, but
 * the user can override the field manually afterward (the two columns
 * remain independent at the DB layer per migration 007's design note —
 * "Computed mutual with end_date by app layer").
 */
export function monthsUntil(endDateStr: string | null | undefined): number | null {
  if (!endDateStr) return null;
  const end = new Date(endDateStr);
  if (Number.isNaN(end.getTime())) return null;

  const today = new Date();
  // Whole-calendar-month delta — counts months crossed, ignoring time-of-day.
  // E.g. today 2026-05-27, end 2026-08-27 → 3 months.
  // If end's day-of-month hasn't been reached yet this month, drop one month
  // so 2026-05-27 → 2026-08-20 is 2 (not 3).
  let total =
    (end.getFullYear() - today.getFullYear()) * 12 +
    (end.getMonth() - today.getMonth());
  if (end.getDate() < today.getDate()) total -= 1;
  return Math.max(0, total);
}
