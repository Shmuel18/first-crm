import { describe, expect, it } from 'vitest';

import { feeBasisOf } from '../domain/fee-terms';

import { CaseFeeTermsSchema } from './case-fee.schema';

const parse = (input: unknown) => CaseFeeTermsSchema.safeParse(input);

describe('CaseFeeTermsSchema', () => {
  it('accepts a fractional percentage, from a string as the input sends it', () => {
    const r = parse({ basis: 'percent', value: '1.5' });
    expect(r.success && r.data.value).toBe(1.5);
  });

  it('rejects a percentage of zero, a negative one, or one above the cap', () => {
    expect(parse({ basis: 'percent', value: '0' }).success).toBe(false);
    expect(parse({ basis: 'percent', value: '-1' }).success).toBe(false);
    expect(parse({ basis: 'percent', value: '15' }).success).toBe(false);
    expect(parse({ basis: 'percent', value: 'abc' }).success).toBe(false);
  });

  it('accepts a fixed sum through the case form money validator', () => {
    const r = parse({ basis: 'fixed', value: '18000' });
    expect(r.success && r.data.value).toBe(18000);
    expect(parse({ basis: 'fixed', value: '-5' }).success).toBe(false);
  });

  it('treats an empty value as clearing the fee, in either basis', () => {
    for (const basis of ['fixed', 'percent'] as const) {
      const r = parse({ basis, value: '' });
      expect(r.success && r.data.value).toBe(null);
    }
  });

  it('rejects an unknown basis', () => {
    expect(parse({ basis: 'monthly', value: '5' }).success).toBe(false);
  });
});

describe('feeBasisOf', () => {
  it('is percent only when a percentage is stored', () => {
    expect(feeBasisOf({ amount: 22500, percent: 1.5 })).toBe('percent');
    expect(feeBasisOf({ amount: null, percent: 1.5 })).toBe('percent');
    expect(feeBasisOf({ amount: 18000, percent: null })).toBe('fixed');
    expect(feeBasisOf({ amount: null, percent: null })).toBe('fixed');
  });
});
