import { describe, expect, it } from 'vitest';

import { computeCaseCycleTime, currentMilestoneStart, daysBetween, resolveOpenedAt } from './cycle-time';

const EXEC = 'exec-id';
const CLOSED = 'closed-id';
const COLLATERAL = 'collateral-id';
const MS = [EXEC, CLOSED];

describe('currentMilestoneStart', () => {
  it('returns null when the case has left ביצוע again', () => {
    // Case 2026-003 (פרלמן), verbatim: ביצוע picked twice by mistake and
    // reverted within a minute. The case has never actually executed.
    expect(
      currentMilestoneStart(
        [
          { entered_at: '2026-06-10T20:24:00Z', status_id: COLLATERAL },
          { entered_at: '2026-07-27T06:04:00Z', status_id: EXEC },
          { entered_at: '2026-07-27T06:05:00Z', status_id: COLLATERAL },
          { entered_at: '2026-07-29T19:08:00Z', status_id: EXEC },
          { entered_at: '2026-07-29T19:08:08Z', status_id: COLLATERAL },
        ],
        MS,
      ),
    ).toBeNull();
  });

  it('returns null for a genuine regression too — 28 days in ביצוע, then back', () => {
    // Case 2026-074. Under the state rule, how long it stayed is irrelevant:
    // it is not in ביצוע now, so it has not executed.
    expect(
      currentMilestoneStart(
        [
          { entered_at: '2026-07-28T00:00:00Z', status_id: EXEC },
          { entered_at: '2026-08-24T18:24:19Z', status_id: COLLATERAL },
        ],
        MS,
      ),
    ).toBeNull();
  });

  it('reports the real date, not an earlier slip, once the case truly arrives', () => {
    expect(
      currentMilestoneStart(
        [
          { entered_at: '2026-06-01T10:00:00Z', status_id: EXEC },
          { entered_at: '2026-06-01T10:00:30Z', status_id: COLLATERAL },
          { entered_at: '2026-07-15T09:00:00Z', status_id: EXEC },
        ],
        MS,
      ),
    ).toBe('2026-07-15T09:00:00Z');
  });

  it('keeps the ביצוע date after the case moves on to בוצע ושולם', () => {
    // The run spans both milestone statuses, so it starts at ביצוע.
    expect(
      currentMilestoneStart(
        [
          { entered_at: '2026-05-01T00:00:00Z', status_id: COLLATERAL },
          { entered_at: '2026-06-01T00:00:00Z', status_id: EXEC },
          { entered_at: '2026-07-01T00:00:00Z', status_id: CLOSED },
        ],
        MS,
      ),
    ).toBe('2026-06-01T00:00:00Z');
  });

  it('handles a case that jumped straight to בוצע ושולם', () => {
    expect(
      currentMilestoneStart(
        [
          { entered_at: '2026-05-01T00:00:00Z', status_id: COLLATERAL },
          { entered_at: '2026-07-01T00:00:00Z', status_id: CLOSED },
        ],
        MS,
      ),
    ).toBe('2026-07-01T00:00:00Z');
  });

  it('is order-independent — it sorts before walking back', () => {
    expect(
      currentMilestoneStart(
        [
          { entered_at: '2026-07-01T00:00:00Z', status_id: CLOSED },
          { entered_at: '2026-06-01T00:00:00Z', status_id: EXEC },
        ],
        MS,
      ),
    ).toBe('2026-06-01T00:00:00Z');
  });

  it('returns null for a case with no history at all', () => {
    expect(currentMilestoneStart([], MS)).toBeNull();
  });
});

describe('resolveOpenedAt', () => {
  it('prefers the hand-entered opening date over the row timestamp', () => {
    expect(resolveOpenedAt('2026-03-12', '2026-06-01T09:00:00Z')).toBe('2026-03-12');
  });

  it('falls back to created_at when the office never filled the date in', () => {
    expect(resolveOpenedAt(null, '2026-06-01T09:00:00Z')).toBe('2026-06-01T09:00:00Z');
  });
});

describe('daysBetween', () => {
  it('counts whole days between two instants', () => {
    expect(daysBetween('2026-03-01T00:00:00Z', '2026-03-31T00:00:00Z')).toBe(30);
  });

  it('rounds to the nearest day rather than truncating', () => {
    expect(daysBetween('2026-03-01T00:00:00Z', '2026-03-02T20:00:00Z')).toBe(2);
  });

  it('returns a negative number when the milestone predates the opening date', () => {
    // A typo in opened_at must stay visible — clamping it to 0 would hide the
    // only signal the office has that the date is wrong.
    expect(daysBetween('2026-07-01T00:00:00Z', '2026-06-01T00:00:00Z')).toBe(-30);
  });

  it('returns null for an unparseable date', () => {
    expect(daysBetween('not-a-date', '2026-06-01T00:00:00Z')).toBeNull();
  });
});

describe('computeCaseCycleTime', () => {
  const NOW = '2026-09-01T12:00:00Z';

  it('measures opening to milestone once the case reached execution', () => {
    expect(
      computeCaseCycleTime('2026-03-12', '2026-06-01T09:00:00Z', '2026-06-20T00:00:00Z', NOW),
    ).toEqual({ state: 'reached', days: 100, reachedAt: '2026-06-20T00:00:00Z' });
  });

  it('measures opening to today while the case is still in flight', () => {
    // 31.5 days → rounds up, same rule as the reached branch.
    expect(computeCaseCycleTime('2026-08-01', '2026-08-01T00:00:00Z', null, NOW)).toEqual({
      state: 'pending',
      days: 32,
    });
  });

  it('uses created_at as the anchor when opened_at is unset', () => {
    // The imported-case path: created_at is the import day, so the number is
    // short — honest given what the data actually knows.
    expect(
      computeCaseCycleTime(null, '2026-06-01T00:00:00Z', '2026-06-11T00:00:00Z', NOW),
    ).toEqual({ state: 'reached', days: 10, reachedAt: '2026-06-11T00:00:00Z' });
  });

  it('returns null when the dates cannot be parsed', () => {
    expect(computeCaseCycleTime(null, 'garbage', null, NOW)).toBeNull();
  });
});
