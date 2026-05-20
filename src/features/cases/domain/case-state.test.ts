import { describe, expect, it } from 'vitest';

import { getInitials, isFrozenCase, isStuckCase } from './case-state';

describe('isStuckCase', () => {
  it('is true only for the stuck status key', () => {
    expect(isStuckCase({ status: { key: 'stuck' } })).toBe(true);
    expect(isStuckCase({ status: { key: 'submitted' } })).toBe(false);
    expect(isStuckCase({ status: null })).toBe(false);
  });
});

describe('isFrozenCase', () => {
  it('is true for on_hold and closed', () => {
    expect(isFrozenCase({ status: { key: 'on_hold' } })).toBe(true);
    expect(isFrozenCase({ status: { key: 'closed' } })).toBe(true);
  });

  it('is false for any other status', () => {
    expect(isFrozenCase({ status: { key: 'stuck' } })).toBe(false);
    expect(isFrozenCase({ status: null })).toBe(false);
  });
});

describe('getInitials', () => {
  it('combines first and last initials', () => {
    expect(getInitials('Moshe', 'Kaufman')).toBe('MK');
  });

  it('falls back gracefully when names are missing', () => {
    expect(getInitials('Moshe', null)).toBe('M');
    expect(getInitials(null, null)).toBe('?');
    expect(getInitials(undefined, undefined)).toBe('?');
  });
});
