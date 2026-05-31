import { describe, expect, it } from 'vitest';

import { chooseReturningCriteria, criteriaKey } from './returning-criteria';

describe('chooseReturningCriteria', () => {
  it('returns null when nothing clears a threshold', () => {
    expect(chooseReturningCriteria({ firstName: '', lastName: '', nationalId: '', phone: '' })).toBeNull();
    // national_id too short, no phone, name incomplete
    expect(
      chooseReturningCriteria({ firstName: 'a', lastName: '', nationalId: '123', phone: '' }),
    ).toBeNull();
  });

  it('prefers national_id over phone and name', () => {
    expect(
      chooseReturningCriteria({
        firstName: 'שמואל',
        lastName: 'הרשקוביץ',
        nationalId: '123456789',
        phone: '0501234567',
      }),
    ).toEqual({ by: 'nationalId', value: '123456789' });
  });

  it('prefers phone over name when no national_id', () => {
    const c = chooseReturningCriteria({
      firstName: 'שמואל',
      lastName: 'הרשקוביץ',
      nationalId: '',
      phone: '0501234567',
    });
    expect(c?.by).toBe('phone');
  });

  it('falls back to full name when both parts are present', () => {
    expect(
      chooseReturningCriteria({ firstName: 'שמואל', lastName: 'הרשקוביץ', nationalId: '', phone: '' }),
    ).toEqual({ by: 'name', firstName: 'שמואל', lastName: 'הרשקוביץ' });
  });

  it('ignores a partial/invalid phone', () => {
    expect(
      chooseReturningCriteria({ firstName: '', lastName: '', nationalId: '', phone: '050' }),
    ).toBeNull();
  });

  it('requires both name parts of at least 2 chars', () => {
    expect(
      chooseReturningCriteria({ firstName: 'ש', lastName: 'הרשקוביץ', nationalId: '', phone: '' }),
    ).toBeNull();
    expect(
      chooseReturningCriteria({ firstName: 'שמואל', lastName: '', nationalId: '', phone: '' }),
    ).toBeNull();
  });

  it('trims whitespace before measuring thresholds', () => {
    expect(
      chooseReturningCriteria({ firstName: '  ', lastName: '  ', nationalId: '   ', phone: '' }),
    ).toBeNull();
  });
});

describe('criteriaKey', () => {
  it('builds a stable key per axis', () => {
    expect(criteriaKey({ by: 'nationalId', value: '123' })).toBe('nationalId:123');
    expect(criteriaKey({ by: 'phone', value: '0501234567' })).toBe('phone:0501234567');
    expect(criteriaKey({ by: 'name', firstName: 'שמואל', lastName: 'כהן' })).toBe('name:שמואל|כהן');
  });
});
