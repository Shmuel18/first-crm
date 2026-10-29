/**
 * Hebrew (Jewish) calendar labels for a YYYY-MM-DD day.
 *
 * Intl supplies the conversion (`he-u-ca-hebrew`) but, in Node and Chrome,
 * prints the day and year as Arabic digits ("18 בחשוון 5787"), so the
 * gematria ("י״ח", "תשפ״ז") is done here. Days are anchored at UTC noon
 * (as in calendar-range.ts), hence `timeZone: 'UTC'`.
 */
const HEBREW_PARTS = new Intl.DateTimeFormat('he-u-ca-hebrew', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];

/** 1–999 in gematria with geresh / gershayim: 5 → ה׳, 15 → ט״ו, 787 → תשפ״ז. */
export function hebrewNumeral(n: number): string {
  const tail = n % 100;
  // 15 and 16 are written ט״ו / ט״ז to avoid spelling the divine name.
  const lower = tail === 15 ? 'טו' : tail === 16 ? 'טז' : `${TENS[Math.floor(tail / 10)]}${ONES[tail % 10]}`;
  const letters = `${HUNDREDS[Math.floor(n / 100) % 10]}${lower}`;
  if (letters.length <= 1) return `${letters}׳`;
  return `${letters.slice(0, -1)}״${letters.slice(-1)}`;
}

/** Intl's number part as gematria; passed through if the engine already used letters. */
function numberPart(value: string, modulo: number): string {
  return /^\d+$/.test(value) ? hebrewNumeral(Number(value) % modulo) : value;
}

export type HebrewDate = { day: string; month: string; year: string };

/** The Hebrew day / month / year of a YYYY-MM-DD, e.g. { "י״ח", "חשוון", "תשפ״ז" }. */
export function hebrewDate(day: string): HebrewDate {
  const parts = HEBREW_PARTS.formatToParts(new Date(`${day}T12:00:00Z`));
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return { day: numberPart(part('day'), 1000), month: part('month'), year: numberPart(part('year'), 1000) };
}

/** "י״ח חשוון" — no year, for day headers. */
export function hebrewDayMonth(day: string): string {
  const h = hebrewDate(day);
  return `${h.day} ${h.month}`;
}

/** A month-grid cell's Hebrew day: "י״ח", or "א׳ חשוון" when a Hebrew month begins. */
export function hebrewCellLabel(day: string): string {
  const h = hebrewDate(day);
  return h.day === 'א׳' ? `${h.day} ${h.month}` : h.day;
}

/** The Hebrew months a span covers: "חשוון תשפ״ז", "תשרי–חשוון תשפ״ז", "אלול תשפ״ו–תשרי תשפ״ז". */
export function hebrewMonthSpan(first: string, last: string): string {
  const a = hebrewDate(first);
  const b = hebrewDate(last);
  if (a.year !== b.year) return `${a.month} ${a.year}–${b.month} ${b.year}`;
  if (a.month !== b.month) return `${a.month}–${b.month} ${b.year}`;
  return `${b.month} ${b.year}`;
}
