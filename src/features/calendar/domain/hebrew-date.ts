/**
 * Hebrew (Jewish) calendar labels for calendar days ("YYYY-MM-DD").
 *
 * Intl supplies the conversion (`ca-hebrew`) and the month names, but Node /
 * Chromium ICU render the day and year in Western digits ("18 בחשוון 5787"),
 * so the numbers are rewritten here as gematria ("י״ח", "תשפ״ז"). Days are
 * UTC-noon anchored like calendar-range.ts, hence `timeZone: 'UTC'`.
 */
const FORMAT = new Intl.DateTimeFormat('he-u-ca-hebrew', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת'];

/** 1–999 as Hebrew numerals: 18 → "י״ח", 15 → "ט״ו", 5 → "ה׳". Thousands are dropped (5787 → "תשפ״ז"). */
export function hebrewNumeral(n: number): string {
  let rest = n % 1000;
  let letters = '';
  while (rest >= 400) {
    letters += 'ת';
    rest -= 400;
  }
  letters += HUNDREDS[Math.floor(rest / 100)];
  rest %= 100;
  // 15 / 16 are written ט״ו / ט״ז so they don't spell a divine name.
  if (rest === 15 || rest === 16) {
    letters += `ט${ONES[rest - 9]}`;
  } else {
    letters += TENS[Math.floor(rest / 10)]! + ONES[rest % 10]!;
  }
  if (letters.length <= 1) return `${letters}׳`;
  return `${letters.slice(0, -1)}״${letters.slice(-1)}`;
}

type HebrewParts = { day: string; month: string; year: string };

/** A digit string as gematria; anything else (an engine that already writes gematria) passes through. */
const asNumeral = (value: string): string => (/^\d+$/.test(value) ? hebrewNumeral(Number(value)) : value);

function partsOf(day: string): HebrewParts {
  const parts = FORMAT.formatToParts(new Date(`${day}T12:00:00Z`));
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '';
  return { day: asNumeral(get('day')), month: get('month'), year: asNumeral(get('year')) };
}

/** Hebrew day of month only: "י״ח". */
export function hebrewDayOfMonth(day: string): string {
  return partsOf(day).day;
}

/** True when the day is the 1st of a Hebrew month (Rosh Chodesh day). */
export function isHebrewMonthStart(day: string): boolean {
  return partsOf(day).day === hebrewNumeral(1);
}

/** Day and month: "י״ח חשוון". */
export function hebrewDayMonth(day: string): string {
  const p = partsOf(day);
  return `${p.day} ${p.month}`;
}

/** Full date: "י״ח חשוון תשפ״ז". */
export function hebrewDate(day: string): string {
  const p = partsOf(day);
  return `${p.day} ${p.month} ${p.year}`;
}

/**
 * The Hebrew months a span of days covers, for a view title:
 * "חשוון תשפ״ז", "תשרי–חשוון תשפ״ז", or across a new year "אלול תשפ״ו – תשרי תשפ״ז".
 */
export function hebrewSpan(first: string, last: string): string {
  const a = partsOf(first);
  const b = partsOf(last);
  if (a.year !== b.year) return `${a.month} ${a.year} – ${b.month} ${b.year}`;
  const months = a.month === b.month ? a.month : `${a.month}–${b.month}`;
  return `${months} ${b.year}`;
}
