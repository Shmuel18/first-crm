import { describe, expect, it } from 'vitest';

import {
  countTasksAwaitingUpdate,
  isTaskAwaitingUpdate,
  STALE_NO_DUE_DATE_DAYS,
} from './task-nudge';

const NOW = new Date('2026-08-02T12:00:00Z');

const daysAgo = (n: number): string =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('isTaskAwaitingUpdate', () => {
  it('flags a pending task whose due date passed', () => {
    expect(
      isTaskAwaitingUpdate(
        { status: 'pending', due_date: daysAgo(1), updated_at: daysAgo(0) },
        NOW,
      ),
    ).toBe(true);
  });

  it('leaves a pending task with a future due date alone', () => {
    expect(
      isTaskAwaitingUpdate(
        { status: 'pending', due_date: daysAgo(-3), updated_at: daysAgo(30) },
        NOW,
      ),
    ).toBe(false);
  });

  it('flags a due-date-less task untouched past the stale window', () => {
    expect(
      isTaskAwaitingUpdate(
        { status: 'pending', due_date: null, updated_at: daysAgo(STALE_NO_DUE_DATE_DAYS) },
        NOW,
      ),
    ).toBe(true);
    expect(
      isTaskAwaitingUpdate(
        { status: 'pending', due_date: null, updated_at: daysAgo(STALE_NO_DUE_DATE_DAYS - 1) },
        NOW,
      ),
    ).toBe(false);
  });

  it('never flags non-pending tasks — snoozing IS an update', () => {
    for (const status of ['snoozed', 'completed', 'cancelled']) {
      expect(
        isTaskAwaitingUpdate({ status, due_date: daysAgo(10), updated_at: daysAgo(10) }, NOW),
      ).toBe(false);
    }
  });

  it('ignores an unparseable updated_at instead of nagging', () => {
    expect(
      isTaskAwaitingUpdate({ status: 'pending', due_date: null, updated_at: 'garbage' }, NOW),
    ).toBe(false);
  });
});

describe('countTasksAwaitingUpdate', () => {
  it('counts only the stale ones', () => {
    expect(
      countTasksAwaitingUpdate(
        [
          { status: 'pending', due_date: daysAgo(2), updated_at: daysAgo(1) },
          { status: 'pending', due_date: daysAgo(-1), updated_at: daysAgo(1) },
          { status: 'snoozed', due_date: daysAgo(5), updated_at: daysAgo(5) },
        ],
        NOW,
      ),
    ).toBe(1);
  });
});
