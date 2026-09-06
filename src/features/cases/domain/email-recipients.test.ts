import { describe, expect, it } from 'vitest';

import {
  buildEmailRecipients,
  defaultRecipientIds,
  selectedRecipients,
  type BorrowerEmailRow,
} from './email-recipients';

const row = (
  id: string,
  email: string | null,
  isPrimary: boolean,
  deletedAt: string | null = null,
): BorrowerEmailRow => ({
  is_primary: isPrimary,
  borrower: {
    id,
    first_name: `first-${id}`,
    last_name: `last-${id}`,
    email,
    deleted_at: deletedAt,
  },
});

describe('buildEmailRecipients', () => {
  it('keeps only borrowers with an address', () => {
    const result = buildEmailRecipients([row('a', null, true), row('b', 'b@x.com', false)]);
    expect(result.map((r) => r.borrowerId)).toEqual(['b']);
  });

  it('puts the primary borrower first regardless of row order', () => {
    const result = buildEmailRecipients([
      row('b', 'b@x.com', false),
      row('a', 'a@x.com', true),
    ]);
    expect(result.map((r) => r.borrowerId)).toEqual(['a', 'b']);
  });

  it('drops soft-deleted borrowers and blank addresses', () => {
    const result = buildEmailRecipients([
      row('a', 'a@x.com', true, '2026-01-01'),
      row('b', '   ', false),
      row('c', ' c@x.com ', false),
      { is_primary: false, borrower: null },
    ]);
    expect(result.map((r) => r.email)).toEqual(['c@x.com']);
  });
});

describe('defaultRecipientIds', () => {
  it('addresses a new draft to the primary borrower', () => {
    const recipients = buildEmailRecipients([row('b', 'b@x.com', false), row('a', 'a@x.com', true)]);
    expect(defaultRecipientIds(recipients)).toEqual(['a']);
  });

  // The bug this whole model exists for: the wife holds the only address.
  it('falls back to the second borrower when the primary has no address', () => {
    const recipients = buildEmailRecipients([row('a', null, true), row('b', 'b@x.com', false)]);
    expect(defaultRecipientIds(recipients)).toEqual(['b']);
  });

  it('is empty when nobody on the case can be emailed', () => {
    expect(defaultRecipientIds(buildEmailRecipients([row('a', null, true)]))).toEqual([]);
  });
});

describe('selectedRecipients', () => {
  it('returns the picked borrowers in list order', () => {
    const recipients = buildEmailRecipients([row('a', 'a@x.com', true), row('b', 'b@x.com', false)]);
    expect(selectedRecipients(recipients, ['b', 'a']).map((r) => r.borrowerId)).toEqual(['a', 'b']);
  });

  it('ignores ids that are not on the case', () => {
    const recipients = buildEmailRecipients([row('a', 'a@x.com', true)]);
    expect(selectedRecipients(recipients, ['zzz'])).toEqual([]);
  });
});
