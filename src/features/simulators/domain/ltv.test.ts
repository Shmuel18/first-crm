import { describe, expect, it } from 'vitest';

import { DEFAULT_REGULATORY_THRESHOLDS } from '../constants';
import { calculateLtvScenario } from './ltv';

describe('calculateLtvScenario', () => {
  it('calculates Israeli LTV and flags an exceeded first-home limit', () => {
    const result = calculateLtvScenario(1_000_000, 800_000, 'first_home', DEFAULT_REGULATORY_THRESHOLDS);

    expect(result.ltvPct).toBe(80);
    expect(result.maxMortgageAmount).toBe(750_000);
    expect(result.excessAmount).toBe(50_000);
    expect(result.status).toBe('exceeded');
  });

  it('returns missing_value when property value is absent', () => {
    expect(calculateLtvScenario(0, 1, 'investment', DEFAULT_REGULATORY_THRESHOLDS).status).toBe('missing_value');
  });
});
