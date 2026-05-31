import { describe, expect, it } from 'vitest';

import {
  compareTargetDates,
  getTargetDateState,
  isValidTargetDate,
  matchesTargetDateFilter,
} from './target-date';

// Fixed reference so the tests don't depend on the real clock.
const NOW = new Date(2026, 5, 15); // 2026-06-15, local

describe('getTargetDateState', () => {
  it('returns none for empty or unparseable input', () => {
    expect(getTargetDateState(null, NOW)).toBe('none');
    expect(getTargetDateState('', NOW)).toBe('none');
    expect(getTargetDateState('not-a-date', NOW)).toBe('none');
  });

  it('flags a past date as overdue', () => {
    expect(getTargetDateState('2026-06-14', NOW)).toBe('overdue');
  });

  it('flags today and within 7 days as soon', () => {
    expect(getTargetDateState('2026-06-15', NOW)).toBe('soon');
    expect(getTargetDateState('2026-06-22', NOW)).toBe('soon');
  });

  it('flags beyond 7 days as future', () => {
    expect(getTargetDateState('2026-06-23', NOW)).toBe('future');
  });
});

describe('matchesTargetDateFilter', () => {
  it('passes everything when there is no filter', () => {
    expect(matchesTargetDateFilter('2026-06-14', null, NOW)).toBe(true);
  });

  it('matches each filter against the right state', () => {
    expect(matchesTargetDateFilter('2026-06-14', 'overdue', NOW)).toBe(true);
    expect(matchesTargetDateFilter('2026-06-23', 'overdue', NOW)).toBe(false);
    expect(matchesTargetDateFilter(null, 'none', NOW)).toBe(true);
    expect(matchesTargetDateFilter('2026-06-15', 'none', NOW)).toBe(false);
    expect(matchesTargetDateFilter('2026-06-18', 'week', NOW)).toBe(true);
    expect(matchesTargetDateFilter('2026-06-30', 'week', NOW)).toBe(false);
  });
});

describe('compareTargetDates', () => {
  it('orders earlier dates first and sorts nulls last', () => {
    expect(compareTargetDates('2026-06-10', '2026-06-20')).toBe(-1);
    expect(compareTargetDates('2026-06-20', '2026-06-10')).toBe(1);
    expect(compareTargetDates('2026-06-10', '2026-06-10')).toBe(0);
    expect(compareTargetDates('2026-06-10', null)).toBe(-1);
    expect(compareTargetDates(null, '2026-06-10')).toBe(1);
    expect(compareTargetDates(null, null)).toBe(0);
  });
});

describe('isValidTargetDate', () => {
  it('accepts a real calendar date, including a leap day', () => {
    expect(isValidTargetDate('2026-06-15')).toBe(true);
    expect(isValidTargetDate('2024-02-29')).toBe(true);
  });

  it('rejects malformed formats', () => {
    expect(isValidTargetDate('2026-6-15')).toBe(false);
    expect(isValidTargetDate('15/06/2026')).toBe(false);
    expect(isValidTargetDate('')).toBe(false);
  });

  it('rejects roll-over / impossible dates a bare regex would accept', () => {
    expect(isValidTargetDate('2020-13-45')).toBe(false);
    expect(isValidTargetDate('2026-02-30')).toBe(false);
    expect(isValidTargetDate('2023-02-29')).toBe(false);
  });
});
