import { describe, expect, it } from 'vitest';

import { israelCivil } from './israel-time';

describe('israelCivil', () => {
  it('computes Israel civil parts in winter (UTC+2)', () => {
    // 2026-01-15T21:30Z → Israel 23:30 the same day.
    expect(israelCivil(new Date(Date.UTC(2026, 0, 15, 21, 30)))).toEqual({
      year: 2026,
      month: 1,
      day: 15,
      hour: 23,
    });
  });

  it('rolls forward into the next civil day once Israel is past midnight (winter)', () => {
    // 2026-01-15T22:30Z → Israel 00:30 on 2026-01-16.
    expect(israelCivil(new Date(Date.UTC(2026, 0, 15, 22, 30)))).toEqual({
      year: 2026,
      month: 1,
      day: 16,
      hour: 0,
    });
  });

  it('computes Israel civil parts in summer (UTC+3)', () => {
    // 2026-06-15T20:30Z → Israel 23:30 the same day.
    expect(israelCivil(new Date(Date.UTC(2026, 5, 15, 20, 30)))).toEqual({
      year: 2026,
      month: 6,
      day: 15,
      hour: 23,
    });
  });
});
