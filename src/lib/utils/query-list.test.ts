import { describe, expect, it } from 'vitest';

import { parseQueryList } from './query-list';

describe('parseQueryList', () => {
  it('returns an empty list for a missing or blank param', () => {
    expect(parseQueryList(undefined)).toEqual([]);
    expect(parseQueryList('')).toEqual([]);
    expect(parseQueryList(' , ')).toEqual([]);
  });

  it('reads a single legacy value', () => {
    expect(parseQueryList('a')).toEqual(['a']);
  });

  it('splits the comma-joined list nuqs writes', () => {
    expect(parseQueryList('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('reads a repeated param', () => {
    expect(parseQueryList(['a', 'b,c'])).toEqual(['a', 'b', 'c']);
  });

  it('restores a comma inside a value (nuqs escapes it as %2C)', () => {
    expect(parseQueryList('Levi%2C Dana,Cohen')).toEqual(['Levi, Dana', 'Cohen']);
  });

  it('collapses duplicates and keeps order', () => {
    expect(parseQueryList('b,a,b')).toEqual(['b', 'a']);
  });
});
