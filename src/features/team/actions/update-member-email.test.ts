import { afterEach, describe, expect, it, vi } from 'vitest';

import { revokeUserSessions } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import { sendEmailChangedEmail } from '../services/team-email';
import { UPDATE_MEMBER_EMAIL_INITIAL } from '../types';
import { updateMemberEmailAction } from './update-member-email';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ revokeUserSessions: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('../services/team-email', () => ({ sendEmailChangedEmail: vi.fn() }));

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';

type QueryResult = {
  data: Array<{ id: string }> | null;
  error: { code?: string; message?: string } | null;
};

function form(email = 'new@example.com'): FormData {
  const data = new FormData();
  data.set('user_id', MEMBER_ID);
  data.set('email', email);
  return data;
}

function updateQuery(result: QueryResult) {
  const query: {
    eq: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    then: Promise<QueryResult>['then'];
  } = {
    eq: vi.fn(),
    select: vi.fn(async () => result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  query.eq.mockReturnValue(query);
  return query;
}

function arrange({
  profileEmail = 'old@example.com',
  authEmail = 'old@example.com',
  authUpdateError = null,
}: {
  profileEmail?: string;
  authEmail?: string;
  authUpdateError?: { code?: string } | null;
} = {}) {
  const updatePayloads: unknown[] = [];
  const updateQueries = [
    updateQuery({ data: [{ id: MEMBER_ID }], error: null }),
    updateQuery({ data: [{ id: MEMBER_ID }], error: null }),
  ];
  let updateIndex = 0;

  const lookup = {
    eq: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn(async () => ({
      data: {
        email: profileEmail,
        first_name: 'Employee',
        language: 'he',
      },
      error: null,
    })),
  };
  lookup.eq.mockReturnValue(lookup);
  lookup.is.mockReturnValue(lookup);

  const from = vi.fn(() => ({
    select: vi.fn(() => lookup),
    update: vi.fn((payload: unknown) => {
      updatePayloads.push(payload);
      return updateQueries[updateIndex++];
    }),
  }));

  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: ACTOR_ID } } })),
    },
    rpc: vi.fn(async () => ({ data: true, error: null })),
    from,
  } as unknown as Awaited<ReturnType<typeof createClient>>);

  const getUserById = vi.fn(async () => ({
    data: { user: { id: MEMBER_ID, email: authEmail } },
    error: null,
  }));
  const updateUserById = vi.fn(async () => ({
    data: { user: null },
    error: authUpdateError,
  }));
  vi.mocked(createAdminClient).mockReturnValue({
    auth: { admin: { getUserById, updateUserById } },
  } as unknown as ReturnType<typeof createAdminClient>);

  vi.mocked(checkRateLimit).mockResolvedValue(true);
  vi.mocked(revokeUserSessions).mockResolvedValue({ ok: true });
  vi.mocked(sendEmailChangedEmail).mockResolvedValue(true);

  return { updatePayloads, updateUserById };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('updateMemberEmailAction', () => {
  it('updates the profile and Auth, then revokes sessions and notifies the employee', async () => {
    const { updatePayloads, updateUserById } = arrange();

    const result = await updateMemberEmailAction(
      UPDATE_MEMBER_EMAIL_INITIAL,
      form(' New@Example.COM '),
    );

    expect(result).toEqual({
      ok: true,
      email: 'new@example.com',
      emailSent: true,
      sessionsRevoked: true,
    });
    expect(updatePayloads[0]).toEqual({
      email: 'new@example.com',
      updated_by: ACTOR_ID,
    });
    expect(updateUserById).toHaveBeenCalledWith(MEMBER_ID, {
      email: 'new@example.com',
      email_confirm: true,
    });
    expect(revokeUserSessions).toHaveBeenCalledWith(expect.anything(), MEMBER_ID);
    expect(sendEmailChangedEmail).toHaveBeenCalledWith({
      to: 'new@example.com',
      firstName: 'Employee',
      locale: 'he',
    });
  });

  it('rolls the profile back when Auth rejects a duplicate address', async () => {
    const { updatePayloads } = arrange({
      authUpdateError: { code: 'email_exists' },
    });

    const result = await updateMemberEmailAction(UPDATE_MEMBER_EMAIL_INITIAL, form());

    expect(result).toMatchObject({ ok: false, error: 'email_exists' });
    expect(updatePayloads).toEqual([
      { email: 'new@example.com', updated_by: ACTOR_ID },
      { email: 'old@example.com', updated_by: ACTOR_ID },
    ]);
    expect(revokeUserSessions).not.toHaveBeenCalled();
    expect(sendEmailChangedEmail).not.toHaveBeenCalled();
  });

  it('refuses to edit an account whose Auth and profile emails already differ', async () => {
    const { updatePayloads, updateUserById } = arrange({
      authEmail: 'different@example.com',
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await updateMemberEmailAction(UPDATE_MEMBER_EMAIL_INITIAL, form());

    expect(result).toMatchObject({ ok: false, error: 'out_of_sync' });
    expect(updatePayloads).toHaveLength(0);
    expect(updateUserById).not.toHaveBeenCalled();
  });
});
