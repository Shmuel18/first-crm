import { describe, expect, it } from 'vitest';

import { hebrewDate, hebrewDayMonth, hebrewDayOfMonth, hebrewNumeral, hebrewSpan, isHebrewMonthStart } from './hebrew-date';

describe('hebrewNumeral', () => {
  it('writes gematria with geresh / gershayim', () => {
    expect(hebrewNumeral(1)).toBe('א׳');
    expect(hebrewNumeral(10)).toBe('י׳');
    expect(hebrewNumeral(18)).toBe('י״ח');
    expect(hebrewNumeral(27)).toBe('כ״ז');
    expect(hebrewNumeral(30)).toBe('ל׳');
  });

  it('writes 15 and 16 as ט״ו / ט״ז', () => {
    expect(hebrewNumeral(15)).toBe('ט״ו');
    expect(hebrewNumeral(16)).toBe('ט״ז');
  });

  it('drops the thousands of a year', () => {
    expect(hebrewNumeral(5787)).toBe('תשפ״ז');
    expect(hebrewNumeral(5786)).toBe('תשפ״ו');
    expect(hebrewNumeral(5800)).toBe('ת״ת');
  });
});

describe('Hebrew dates of calendar days', () => {
  it('converts a Gregorian day', () => {
    // 29 Oct 2026 = 18 Cheshvan 5787.
    expect(hebrewDayOfMonth('2026-10-29')).toBe('י״ח');
    expect(hebrewDayMonth('2026-10-29')).toBe('י״ח חשוון');
    expect(hebrewDate('2026-10-29')).toBe('י״ח חשוון תשפ״ז');
  });

  it('knows the first of a Hebrew month', () => {
    // Rosh Hashana 5787 = 12 Sep 2026.
    expect(isHebrewMonthStart('2026-09-12')).toBe(true);
    expect(isHebrewMonthStart('2026-09-13')).toBe(false);
  });
});

describe('hebrewSpan', () => {
  it('names one month once', () => {
    expect(hebrewSpan('2026-10-25', '2026-10-31')).toBe('חשוון תשפ״ז');
  });

  it('joins two months of the same year with a dash', () => {
    // October 2026 runs from 19 Tishrei to 20 Cheshvan.
    expect(hebrewSpan('2026-10-01', '2026-10-31')).toBe('תשרי–חשוון תשפ״ז');
  });

  it('spells both years across Rosh Hashana', () => {
    // September 2026 starts in Elul 5786.
    expect(hebrewSpan('2026-09-01', '2026-09-30')).toBe('אלול תשפ״ו – תשרי תשפ״ז');
  });
});
