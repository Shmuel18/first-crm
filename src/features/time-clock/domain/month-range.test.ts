import { describe, expect, it } from 'vitest';

import { israelMonthRange } from './month-range';

describe('israelMonthRange', () => {
  // Summer (UTC+3): the Israel month starts at 21:00 UTC the previous day.
  it('covers the current Israel month', () => {
    const now = Date.parse('2026-07-19T09:00:00.000Z');
    expect(israelMonthRange(now, 0)).toEqual({
      fromISO: '2026-06-30T21:00:00.000Z',
      toISO: '2026-07-31T21:00:00.000Z',
    });
  });

  it('walks back to previous months', () => {
    const now = Date.parse('2026-07-19T09:00:00.000Z');
    expect(israelMonthRange(now, -1)).toEqual({
      fromISO: '2026-05-31T21:00:00.000Z',
      toISO: '2026-06-30T21:00:00.000Z',
    });
  });

  // Winter is UTC+2, so a range that straddles the DST switch has different
  // offsets on each edge — that's exactly what israelDayStartIso resolves.
  it('shifts with DST inside the range', () => {
    const now = Date.parse('2026-11-10T09:00:00.000Z');
    expect(israelMonthRange(now, 0)).toEqual({
      fromISO: '2026-10-31T22:00:00.000Z',
      toISO: '2026-11-30T22:00:00.000Z',
    });
  });

  it('crosses the year boundary going back', () => {
    const now = Date.parse('2026-01-15T09:00:00.000Z');
    expect(israelMonthRange(now, -1)).toEqual({
      fromISO: '2025-11-30T22:00:00.000Z',
      toISO: '2025-12-31T22:00:00.000Z',
    });
  });

  it('is contiguous — one month ends exactly where the next begins', () => {
    const now = Date.parse('2026-07-19T09:00:00.000Z');
    for (let offset = -13; offset < 0; offset += 1) {
      expect(israelMonthRange(now, offset).toISO).toBe(israelMonthRange(now, offset + 1).fromISO);
    }
  });
});
