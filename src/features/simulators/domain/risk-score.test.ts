import { describe, expect, it } from 'vitest';

import { scoreRisk } from './risk-score';

describe('scoreRisk', () => {
  it('returns low below both medium thresholds', () => {
    expect(scoreRisk(0, 0)).toBe('low');
    expect(scoreRisk(9.9, 4.9)).toBe('low');
  });

  it('returns medium at either medium threshold', () => {
    expect(scoreRisk(10, 0)).toBe('medium');
    expect(scoreRisk(0, 5)).toBe('medium');
    expect(scoreRisk(19.9, 4.9)).toBe('medium');
  });

  it('returns high at either high threshold', () => {
    expect(scoreRisk(20, 0)).toBe('high');
    expect(scoreRisk(0, 10)).toBe('high');
  });

  it('escalates when only one dimension is severe (OR logic)', () => {
    expect(scoreRisk(5, 10)).toBe('high');
    expect(scoreRisk(25, 0)).toBe('high');
  });
});
