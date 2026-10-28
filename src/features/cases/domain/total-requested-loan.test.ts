import { describe, expect, it } from 'vitest';

import { totalRequestedLoan } from './total-requested-loan';

describe('totalRequestedLoan', () => {
  it('adds the additional properties to the primary loan', () => {
    expect(
      totalRequestedLoan(3_000_000, [{ requested_mortgage_amount: 7_096_914 }]),
    ).toBe(10_096_914);
  });

  it('skips properties without a loan figure', () => {
    expect(totalRequestedLoan(null, [{ requested_mortgage_amount: 500_000 }])).toBe(500_000);
    expect(totalRequestedLoan(800_000, [{ requested_mortgage_amount: null }])).toBe(800_000);
  });

  it('is null when no property has a loan', () => {
    expect(totalRequestedLoan(null, [])).toBeNull();
    expect(totalRequestedLoan(null, [{ requested_mortgage_amount: null }])).toBeNull();
  });
});
