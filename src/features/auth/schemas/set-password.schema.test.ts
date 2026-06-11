import { describe, expect, it } from 'vitest';

import { SetPasswordSchema } from './set-password.schema';

describe('SetPasswordSchema', () => {
  it('accepts a password with a letter and a digit, confirmed', () => {
    const res = SetPasswordSchema.safeParse({ password: 'abc12345', confirm: 'abc12345' });
    expect(res.success).toBe(true);
  });

  it('rejects all-letter passwords as weak', () => {
    const res = SetPasswordSchema.safeParse({ password: 'aaaaaaaa', confirm: 'aaaaaaaa' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path[0] === 'password' && i.message === 'weak')).toBe(
        true,
      );
    }
  });

  it('rejects all-digit passwords as weak', () => {
    const res = SetPasswordSchema.safeParse({ password: '12345678', confirm: '12345678' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.message === 'weak')).toBe(true);
    }
  });

  it('rejects short passwords via the min-length rule (not weak)', () => {
    const res = SetPasswordSchema.safeParse({ password: 'a1', confirm: 'a1' });
    expect(res.success).toBe(false);
  });

  it('flags mismatched confirmation on the confirm path', () => {
    const res = SetPasswordSchema.safeParse({ password: 'abc12345', confirm: 'different1' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(
        res.error.issues.some((i) => i.path[0] === 'confirm' && i.message === 'mismatch'),
      ).toBe(true);
    }
  });

  it('accepts Hebrew letters as the letter requirement', () => {
    const res = SetPasswordSchema.safeParse({ password: 'שלום1234', confirm: 'שלום1234' });
    expect(res.success).toBe(true);
  });
});
