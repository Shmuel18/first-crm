import { describe, expect, it } from 'vitest';

import {
  getCaseClientLabel,
  getCaseClientLabelFull,
  getPrimaryBank,
  getPrimaryBorrowerNationalId,
  getSecondaryBanksCount,
} from './case-derivations';

function cb(
  is_primary: boolean,
  first: string | null,
  last: string | null,
  national_id: string | null = null,
) {
  return { is_primary, borrower: { first_name: first, last_name: last, national_id } };
}

function bankLink(is_primary: boolean, id: string, deleted_at: string | null = null) {
  return {
    is_primary,
    deleted_at,
    bank: { id, name_he: id, name_en: id, color: '#000', logo_url: null, key: id },
  };
}

describe('getCaseClientLabel', () => {
  it('returns empty string when there are no borrowers', () => {
    expect(getCaseClientLabel({ case_borrowers: [] })).toBe('');
    expect(getCaseClientLabel({ case_borrowers: null })).toBe('');
    expect(getCaseClientLabel({})).toBe('');
  });

  it('returns the single borrower name', () => {
    expect(getCaseClientLabel({ case_borrowers: [cb(true, 'ישראל', 'ישראלי')] })).toBe(
      'ישראלי ישראל',
    );
  });

  it('surfaces additional borrowers as +N with the primary first (compact)', () => {
    const label = getCaseClientLabel({
      case_borrowers: [cb(false, 'דנה', 'כהן'), cb(true, 'ישראל', 'ישראלי')],
    });
    expect(label).toBe('ישראלי ישראל +1');
  });

  it('ignores null borrowers and blank names', () => {
    expect(
      getCaseClientLabel({
        case_borrowers: [
          { is_primary: true, borrower: null },
          cb(false, '', ''),
          cb(false, 'דנה', 'כהן'),
        ],
      }),
    ).toBe('כהן דנה');
  });
});

describe('getCaseClientLabelFull', () => {
  it('returns the single borrower name', () => {
    expect(getCaseClientLabelFull({ case_borrowers: [cb(true, 'ישראל', 'ישראלי')] })).toBe(
      'ישראלי ישראל',
    );
  });

  it('shows both names (primary first) for two borrowers — no "+1"', () => {
    const label = getCaseClientLabelFull({
      case_borrowers: [cb(false, 'דנה', 'כהן'), cb(true, 'ישראל', 'ישראלי')],
    });
    expect(label).toBe('ישראלי ישראל · כהן דנה');
  });

  it('shows the first two names + "+N" for three or more borrowers', () => {
    const label = getCaseClientLabelFull({
      case_borrowers: [
        cb(false, 'דנה', 'כהן'),
        cb(true, 'ישראל', 'ישראלי'),
        cb(false, 'אבי', 'לוי'),
      ],
    });
    expect(label).toBe('ישראלי ישראל · כהן דנה +1');
  });

  it('returns empty string when there are no borrowers', () => {
    expect(getCaseClientLabelFull({ case_borrowers: [] })).toBe('');
  });
});

describe('getPrimaryBorrowerNationalId', () => {
  it('returns the primary borrower national id', () => {
    expect(
      getPrimaryBorrowerNationalId({
        case_borrowers: [cb(false, 'a', 'a', '111'), cb(true, 'b', 'b', '222')],
      }),
    ).toBe('222');
  });

  it('falls back to the first borrower when none is primary', () => {
    expect(
      getPrimaryBorrowerNationalId({ case_borrowers: [cb(false, 'a', 'a', '111')] }),
    ).toBe('111');
  });

  it('returns null when there are no borrowers', () => {
    expect(getPrimaryBorrowerNationalId({ case_borrowers: [] })).toBeNull();
  });
});

describe('getPrimaryBank', () => {
  it('returns the primary among active banks', () => {
    const result = getPrimaryBank({
      case_banks: [bankLink(false, 'leumi'), bankLink(true, 'poalim')],
    });
    expect(result?.id).toBe('poalim');
  });

  it('excludes soft-deleted bank links', () => {
    const result = getPrimaryBank({
      case_banks: [bankLink(true, 'leumi', '2026-01-01'), bankLink(false, 'poalim')],
    });
    expect(result?.id).toBe('poalim');
  });

  it('returns null when all banks are deleted or absent', () => {
    expect(getPrimaryBank({ case_banks: [bankLink(true, 'leumi', '2026-01-01')] })).toBeNull();
    expect(getPrimaryBank({ case_banks: null })).toBeNull();
  });
});

describe('getSecondaryBanksCount', () => {
  it('counts active banks beyond the first', () => {
    expect(
      getSecondaryBanksCount({
        case_banks: [bankLink(true, 'a'), bankLink(false, 'b'), bankLink(false, 'c')],
      }),
    ).toBe(2);
  });

  it('ignores soft-deleted banks', () => {
    expect(
      getSecondaryBanksCount({
        case_banks: [bankLink(true, 'a'), bankLink(false, 'b', '2026-01-01')],
      }),
    ).toBe(0);
  });

  it('returns 0 for one or zero banks', () => {
    expect(getSecondaryBanksCount({ case_banks: [bankLink(true, 'a')] })).toBe(0);
    expect(getSecondaryBanksCount({ case_banks: [] })).toBe(0);
  });
});
