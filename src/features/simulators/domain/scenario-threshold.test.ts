import { describe, expect, it } from 'vitest';

import { firstMonthAboveThreshold } from './scenario-threshold';

import type { CurvePoint } from '../types';

const curve: ReadonlyArray<CurvePoint> = [
  { monthIndex: 0, value: 5_000 },
  { monthIndex: 1, value: 5_500 },
  { monthIndex: 2, value: 6_200 },
  { monthIndex: 3, value: 6_800 },
];

describe('firstMonthAboveThreshold', () => {
  it('returns the month index of the first point strictly above the threshold', () => {
    expect(firstMonthAboveThreshold(curve, 6_000)).toBe(2);
  });

  it('uses a strict comparison so an exact match does not count as a cross', () => {
    expect(firstMonthAboveThreshold(curve, 6_200)).toBe(3);
  });

  it('returns null when no point exceeds the threshold', () => {
    expect(firstMonthAboveThreshold(curve, 10_000)).toBeNull();
  });

  it('returns null for an empty curve', () => {
    expect(firstMonthAboveThreshold([], 1_000)).toBeNull();
  });
});
