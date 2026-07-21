import { describe, expect, it } from 'vitest';

import { israelCivil, israelDayStartIso } from '@/lib/utils/israel-time';

import { isCaseUnread, unreadResetBoundary } from './unread-star';

/** Weekday (0=Sun..6=Sat) of an Israel civil date, TZ-independent. */
function civilWeekday(iso: string): number {
  const { year, month, day } = israelCivil(new Date(iso));
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('unreadResetBoundary', () => {
  // A summer instant (Israel is UTC+3 / IDT) and a winter one (UTC+2 / IST) so
  // the DST-offset math is exercised on both sides.
  const summer = new Date('2026-07-21T10:00:00+03:00');
  const winter = new Date('2026-01-20T10:00:00+02:00');

  it('off → null (feature disabled, never unread)', () => {
    expect(unreadResetBoundary('off', 0, summer)).toBeNull();
  });

  it('daily → the current Israel civil midnight', () => {
    const { year, month, day } = israelCivil(summer);
    expect(unreadResetBoundary('daily', 0, summer)).toBe(israelDayStartIso(year, month, day));
  });

  it('daily boundary is at-or-before now and within ~1 day', () => {
    for (const now of [summer, winter]) {
      const b = unreadResetBoundary('daily', 0, now)!;
      const gap = now.getTime() - new Date(b).getTime();
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThan(DAY_MS + 60 * 60 * 1000); // +1h DST slack
    }
  });

  it('weekly → lands on the requested weekday, at-or-before now, within 7 days', () => {
    for (const now of [summer, winter]) {
      for (let wd = 0; wd <= 6; wd++) {
        const b = unreadResetBoundary('weekly', wd, now)!;
        expect(civilWeekday(b)).toBe(wd); // correct day of week
        const gap = now.getTime() - new Date(b).getTime();
        expect(gap).toBeGreaterThanOrEqual(0); // never in the future
        expect(gap).toBeLessThan(7 * DAY_MS + 60 * 60 * 1000); // within a week (+DST slack)
      }
    }
  });

  it('weekly on today’s own weekday resets to today (daysBack = 0)', () => {
    const todayWd = civilWeekday(summer.toISOString());
    expect(unreadResetBoundary('weekly', todayWd, summer)).toBe(
      unreadResetBoundary('daily', 0, summer),
    );
  });
});

describe('isCaseUnread', () => {
  const boundary = '2026-07-19T21:00:00.000Z'; // an Israel Sunday midnight

  it('feature off (null boundary) is never unread', () => {
    expect(isCaseUnread(null, null)).toBe(false);
    expect(isCaseUnread('2020-01-01T00:00:00Z', null)).toBe(false);
  });

  it('never opened → unread', () => {
    expect(isCaseUnread(null, boundary)).toBe(true);
  });

  it('opened before the boundary → unread', () => {
    expect(isCaseUnread('2026-07-18T09:00:00+03:00', boundary)).toBe(true);
  });

  it('opened at/after the boundary → read', () => {
    expect(isCaseUnread('2026-07-20T08:00:00+03:00', boundary)).toBe(false);
  });

  it('tolerates the Postgres timestamptz format (+00:00, not Z)', () => {
    expect(isCaseUnread('2026-07-18T06:00:00+00:00', boundary)).toBe(true);
    expect(isCaseUnread('2026-07-20T06:00:00+00:00', boundary)).toBe(false);
  });
});
