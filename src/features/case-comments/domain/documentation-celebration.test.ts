import { describe, expect, it } from 'vitest';

import { isDocumentationMilestone } from './documentation-celebration';

describe('isDocumentationMilestone', () => {
  it.each([
    [0, false],
    [1, false],
    [4, false],
    [5, true],
    [9, false],
    [10, true],
  ])('classifies %i authored updates', (count, expected) => {
    expect(isDocumentationMilestone(count)).toBe(expected);
  });
});
