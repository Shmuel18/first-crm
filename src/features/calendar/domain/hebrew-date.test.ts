import { describe, expect, it } from 'vitest';

import { hebrewCellLabel, hebrewDate, hebrewDayMonth, hebrewMonthSpan, hebrewNumeral } from './hebrew-date';
import { hebrewTitle } from './hebrew-title';

describe('hebrewNumeral', () => {
  it('marks a single letter with a geresh', () => {
    expect(hebrewNumeral(1)).toBe('א׳');
    expect(hebrewNumeral(10)).toBe('י׳');
    expect(hebrewNumeral(30)).toBe('ל׳');
  });

  it('puts gershayim before the last letter', () => {
    expect(hebrewNumeral(18)).toBe('י״ח');
    expect(hebrewNumeral(27)).toBe('כ״ז');
    expect(hebrewNumeral(787)).toBe('תשפ״ז');
  });

  it('writes 15 and 16 as ט״ו / ט״ז', () => {
    expect(hebrewNumeral(15)).toBe('ט״ו');
    expect(hebrewNumeral(16)).toBe('ט״ז');
    expect(hebrewNumeral(715)).toBe('תשט״ו');
  });
});

describe('hebrewDate', () => {
  it('converts a Gregorian day', () => {
    // 29 Oct 2026 = 18 Heshvan 5787.
    expect(hebrewDate('2026-10-29')).toEqual({ day: 'י״ח', month: 'חשוון', year: 'תשפ״ז' });
    expect(hebrewDayMonth('2026-10-29')).toBe('י״ח חשוון');
  });

  it('starts the year on Rosh Hashana', () => {
    expect(hebrewDate('2026-09-11')).toMatchObject({ day: 'כ״ט', month: 'אלול', year: 'תשפ״ו' });
    expect(hebrewDate('2026-09-12')).toMatchObject({ day: 'א׳', month: 'תשרי', year: 'תשפ״ז' });
  });
});

describe('hebrewCellLabel', () => {
  it('names the month on its first day only', () => {
    expect(hebrewCellLabel('2026-10-29')).toBe('י״ח');
    expect(hebrewCellLabel('2026-10-12')).toBe('א׳ חשוון');
  });
});

describe('hebrewMonthSpan', () => {
  it('shows one month when the span stays inside it', () => {
    expect(hebrewMonthSpan('2026-10-25', '2026-10-31')).toBe('חשוון תשפ״ז');
  });

  it('joins two months of the same year', () => {
    // October 2026 runs from 20 Tishrei to 20 Heshvan.
    expect(hebrewMonthSpan('2026-10-01', '2026-10-31')).toBe('תשרי–חשוון תשפ״ז');
  });

  it('names both years across Rosh Hashana', () => {
    expect(hebrewMonthSpan('2026-09-01', '2026-09-30')).toBe('אלול תשפ״ו–תשרי תשפ״ז');
  });
});

describe('hebrewTitle', () => {
  it('covers the whole Gregorian month in the month view', () => {
    expect(hebrewTitle('month', '2026-10-29')).toBe('תשרי–חשוון תשפ״ז');
  });

  it('covers the visible week', () => {
    // Week of 25–31 Oct 2026 lies inside Heshvan.
    expect(hebrewTitle('week', '2026-10-29')).toBe('חשוון תשפ״ז');
  });

  it('gives the full date in the day view', () => {
    expect(hebrewTitle('day', '2026-10-29')).toBe('י״ח חשוון תשפ״ז');
  });
});
