import { describe, expect, it } from 'vitest';

import { MAASER_QUOTES, pickDailyQuote } from './quotes';

describe('pickDailyQuote', () => {
  it('returns a valid quote with text + source', () => {
    const q = pickDailyQuote('2026-06-21');
    expect(MAASER_QUOTES).toContainEqual(q);
    expect(q.text.length).toBeGreaterThan(0);
    expect(q.source.length).toBeGreaterThan(0);
  });

  it('is stable for the same day', () => {
    expect(pickDailyQuote('2026-06-21')).toEqual(pickDailyQuote('2026-06-21'));
  });

  it('changes from one day to the next (rotates daily)', () => {
    expect(pickDailyQuote('2026-06-21')).not.toEqual(pickDailyQuote('2026-06-22'));
  });

  it('falls back gracefully on a malformed date', () => {
    expect(pickDailyQuote('not-a-date')).toEqual(MAASER_QUOTES[0]);
  });
});
