import { describe, expect, it } from 'vitest';

import { UpdateMemberEmailSchema } from './team.schema';

const USER_ID = '11111111-1111-4111-8111-111111111111';

describe('UpdateMemberEmailSchema', () => {
  it('normalizes the new address before it reaches Auth and profiles', () => {
    const result = UpdateMemberEmailSchema.parse({
      user_id: USER_ID,
      email: '  Employee@Example.COM  ',
    });

    expect(result).toEqual({
      user_id: USER_ID,
      email: 'employee@example.com',
    });
  });

  it('rejects an invalid address', () => {
    expect(
      UpdateMemberEmailSchema.safeParse({
        user_id: USER_ID,
        email: 'not-an-email',
      }).success,
    ).toBe(false);
  });

  it('rejects a malformed member id supplied outside the UI', () => {
    expect(
      UpdateMemberEmailSchema.safeParse({
        user_id: 'not-a-user-id',
        email: 'employee@example.com',
      }).success,
    ).toBe(false);
  });
});
