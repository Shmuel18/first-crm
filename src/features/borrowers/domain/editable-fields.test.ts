import { describe, expect, it } from 'vitest';

import { EDITABLE_FIELDS, isEditableBorrowerField } from './editable-fields';

describe('isEditableBorrowerField', () => {
  it('accepts every whitelisted borrower field', () => {
    for (const field of EDITABLE_FIELDS) {
      expect(isEditableBorrowerField(field)).toBe(true);
    }
  });

  it('rejects junction fields that live on case_borrowers, not borrowers', () => {
    // role_in_case / is_primary have their own action — patching them through
    // the borrower-table bridge must never be allowed.
    expect(isEditableBorrowerField('role_in_case')).toBe(false);
    expect(isEditableBorrowerField('is_primary')).toBe(false);
  });

  it('rejects protected / system columns a manipulated request might target', () => {
    for (const field of [
      'id',
      'created_at',
      'created_by',
      'updated_at',
      'updated_by',
      'deleted_at',
      'deleted_by',
      'metadata',
      'version',
    ]) {
      expect(isEditableBorrowerField(field)).toBe(false);
    }
  });

  it('rejects empty, unknown, and prototype-pollution probes', () => {
    expect(isEditableBorrowerField('')).toBe(false);
    expect(isEditableBorrowerField('not_a_column')).toBe(false);
    expect(isEditableBorrowerField('__proto__')).toBe(false);
    expect(isEditableBorrowerField('constructor')).toBe(false);
    expect(isEditableBorrowerField('toString')).toBe(false);
  });
});
