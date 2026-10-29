import { describe, expect, it } from 'vitest';

import { siblingNav } from './sibling-nav';

describe('siblingNav', () => {
  it('points at the neighbours in folder order', () => {
    expect(siblingNav(['a', 'b', 'c'], 'b')).toEqual({
      position: 2,
      total: 3,
      prevId: 'a',
      nextId: 'c',
    });
  });

  it('has no neighbour past either end', () => {
    expect(siblingNav(['a', 'b'], 'a')).toMatchObject({ prevId: null, nextId: 'b' });
    expect(siblingNav(['a', 'b'], 'b')).toMatchObject({ prevId: 'a', nextId: null });
  });

  it('is null for a lone document or one no longer listed', () => {
    expect(siblingNav(['a'], 'a')).toBeNull();
    expect(siblingNav(['a', 'b'], 'x')).toBeNull();
  });
});
