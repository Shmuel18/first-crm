import { describe, expect, it } from 'vitest';

import { countTasksAwaitingUpdate, isTaskAwaitingUpdate } from './task-nudge';

// Israel is UTC+3 in August 2026. 2026-08-03 is a Monday, 2026-07-30 a Thursday.
const pending = (due_date: string | null, updated_at: string) => ({
  status: 'pending',
  due_date,
  updated_at,
});

describe('isTaskAwaitingUpdate', () => {
  it('flags a pending task whose due date passed', () => {
    expect(
      isTaskAwaitingUpdate(
        pending('2026-08-02T10:00:00Z', '2026-08-03T05:00:00Z'),
        new Date('2026-08-03T06:00:00Z'),
      ),
    ).toBe(true);
  });

  it('leaves a pending task with a future due date alone', () => {
    expect(
      isTaskAwaitingUpdate(
        pending('2026-08-09T10:00:00Z', '2026-07-01T05:00:00Z'),
        new Date('2026-08-03T06:00:00Z'),
      ),
    ).toBe(false);
  });

  it('flags a due-date-less task after 24 business hours (Mon → Tue)', () => {
    const updated = '2026-08-03T06:00:00Z'; // Monday 09:00 Israel
    expect(isTaskAwaitingUpdate(pending(null, updated), new Date('2026-08-04T05:59:00Z'))).toBe(
      false, // 23 business hours
    );
    expect(isTaskAwaitingUpdate(pending(null, updated), new Date('2026-08-04T06:00:00Z'))).toBe(
      true, // 24 business hours
    );
  });

  it('skips the Israeli weekend (Thu noon → Sun noon, not Friday)', () => {
    const updated = '2026-07-30T09:00:00Z'; // Thursday 12:00 Israel
    // Saturday: raw age is >24h but only ~11 business hours elapsed.
    expect(isTaskAwaitingUpdate(pending(null, updated), new Date('2026-08-01T09:00:00Z'))).toBe(
      false,
    );
    // Sunday 11:00 Israel: 23 business hours — still quiet.
    expect(isTaskAwaitingUpdate(pending(null, updated), new Date('2026-08-02T08:00:00Z'))).toBe(
      false,
    );
    // Sunday 12:00 Israel: the 24th business hour lands.
    expect(isTaskAwaitingUpdate(pending(null, updated), new Date('2026-08-02T09:00:00Z'))).toBe(
      true,
    );
  });

  it('flags an ancient task via the raw-age early exit', () => {
    expect(
      isTaskAwaitingUpdate(pending(null, '2026-07-01T00:00:00Z'), new Date('2026-08-03T06:00:00Z')),
    ).toBe(true);
  });

  it('never flags non-pending tasks — snoozing IS an update', () => {
    for (const status of ['snoozed', 'completed', 'cancelled']) {
      expect(
        isTaskAwaitingUpdate(
          { status, due_date: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z' },
          new Date('2026-08-03T06:00:00Z'),
        ),
      ).toBe(false);
    }
  });

  it('ignores an unparseable updated_at instead of nagging', () => {
    expect(
      isTaskAwaitingUpdate(pending(null, 'garbage'), new Date('2026-08-03T06:00:00Z')),
    ).toBe(false);
  });
});

describe('countTasksAwaitingUpdate', () => {
  it('counts only the stale ones', () => {
    const now = new Date('2026-08-03T06:00:00Z');
    expect(
      countTasksAwaitingUpdate(
        [
          pending('2026-08-01T10:00:00Z', '2026-08-03T05:00:00Z'), // overdue
          pending('2026-08-09T10:00:00Z', '2026-08-03T05:00:00Z'), // future due
          pending(null, '2026-08-03T05:00:00Z'), // fresh
          { status: 'snoozed', due_date: null, updated_at: '2026-07-01T00:00:00Z' },
        ],
        now,
      ),
    ).toBe(1);
  });
});
