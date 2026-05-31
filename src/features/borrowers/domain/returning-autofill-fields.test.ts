import { describe, expect, it } from 'vitest';

import {
  applyMatchFields,
  pickReturningFields,
  returningOverwrittenFields,
} from './returning-autofill-fields';

import type { ReturningBorrowerMatch } from '../types';

const MATCH: ReturningBorrowerMatch = {
  id: 'b1',
  first_name: 'שמואל',
  last_name: 'הרשקוביץ',
  national_id: '123456789',
  phone: '0501234567',
  landline_phone: null,
  email: 'shmuel@example.com',
  preferred_language: 'he',
  id_issue_date: null,
  birth_date: null,
  marital_status: null,
  children_count: null,
  address: null,
  city: 'תל אביב',
  citizenship: null,
  residency_type: null,
  employment_status: null,
  employer_name: null,
};

describe('pickReturningFields', () => {
  it('stringifies values and maps null to empty string', () => {
    const picked = pickReturningFields(MATCH);
    expect(picked.first_name).toBe('שמואל');
    expect(picked.national_id).toBe('123456789');
    expect(picked.landline_phone).toBe('');
  });
});

describe('returningOverwrittenFields', () => {
  it('flags only fields that had a different non-empty prior value', () => {
    const picked = pickReturningFields(MATCH);
    const overwritten = returningOverwrittenFields(
      { first_name: 'דוד', phone: '', email: 'shmuel@example.com' },
      picked,
    );
    expect(overwritten).toContain('first_name'); // 'דוד' → 'שמואל'
    expect(overwritten).not.toContain('phone'); // was empty → silent fill
    expect(overwritten).not.toContain('email'); // identical → not an overwrite
  });

  it('treats whitespace-only prior values as empty (no flag)', () => {
    const picked = pickReturningFields(MATCH);
    expect(returningOverwrittenFields({ city: '   ' }, picked)).not.toContain('city');
  });
});

describe('applyMatchFields', () => {
  it('merges fill fields onto the current object, leaving non-fill keys intact', () => {
    const current = { tempId: 'x', first_name: '', city: '', role_in_case: 'guarantor' };
    const next = applyMatchFields(current, MATCH);
    expect(next.first_name).toBe('שמואל');
    expect(next.city).toBe('תל אביב');
    expect(next.tempId).toBe('x'); // untouched
    expect(next.role_in_case).toBe('guarantor'); // deal-scoped, not overwritten
  });
});
