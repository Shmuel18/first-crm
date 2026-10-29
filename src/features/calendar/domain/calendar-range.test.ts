import { describe, expect, it } from 'vitest';

import { addDays, isCalendarDay, rangeFor, shiftAnchor } from './calendar-range';

describe('rangeFor', () => {
  it('shows a month as six weeks starting on the Sunday before the 1st', () => {
    // 1 Oct 2026 is a Thursday → the grid starts on Sunday 27 Sep.
    const r = rangeFor('month', '2026-10-29');
    expect(r.from).toBe('2026-09-27');
    expect(r.days).toHaveLength(42);
    expect(r.to).toBe('2026-11-08');
  });

  it('starts a week on Sunday', () => {
    // 29 Oct 2026 is a Thursday.
    expect(rangeFor('week', '2026-10-29').days).toEqual([
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
    ]);
  });

  it('covers one day, and 30 days for the agenda', () => {
    expect(rangeFor('day', '2026-10-29').days).toEqual(['2026-10-29']);
    expect(rangeFor('agenda', '2026-10-29').days).toHaveLength(30);
  });
});

describe('shiftAnchor', () => {
  it('moves a month by calendar month, a week by 7 days', () => {
    expect(shiftAnchor('month', '2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftAnchor('week', '2026-10-29', -1)).toBe('2026-10-22');
    expect(shiftAnchor('day', '2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('day helpers', () => {
  it('adds days across a DST change and validates dates', () => {
    expect(addDays('2026-03-26', 2)).toBe('2026-03-28');
    expect(isCalendarDay('2026-02-30')).toBe(false);
    expect(isCalendarDay('2026-02-28')).toBe(true);
  });
});
