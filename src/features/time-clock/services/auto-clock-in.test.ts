import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

import { autoClockInIfEnabled } from './auto-clock-in';

const USER_ID = '11111111-1111-4111-8111-111111111111';

type DbError = { code?: string };

type MockProfile = {
  time_tracked: boolean;
  auto_clock_in: boolean;
  is_active: boolean;
  deleted_at: string | null;
};

type MockOptions = {
  authUserId?: string | null;
  authError?: DbError | null;
  profile?: MockProfile | null;
  profileError?: DbError | null;
  open?: { id: string } | null;
  openError?: DbError | null;
  insertError?: DbError | null;
};

function makeClient(options: MockOptions = {}) {
  const profile =
    options.profile === undefined
      ? { time_tracked: true, auto_clock_in: true, is_active: true, deleted_at: null }
      : options.profile;
  const authUser = options.authUserId === undefined ? { id: USER_ID } : options.authUserId ? { id: options.authUserId } : null;

  const getUser = vi.fn(async () => ({ data: { user: authUser }, error: options.authError ?? null }));
  const profileMaybeSingle = vi.fn(async () => ({ data: profile, error: options.profileError ?? null }));
  const openMaybeSingle = vi.fn(async () => ({ data: options.open ?? null, error: options.openError ?? null }));
  const insert = vi.fn(async () => ({ error: options.insertError ?? null }));

  const from = vi.fn((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: profileMaybeSingle })),
        })),
      };
    }

    if (table === 'time_entries') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              is: vi.fn(() => ({ maybeSingle: openMaybeSingle })),
            })),
          })),
        })),
        insert,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { auth: { getUser }, from } as unknown as SupabaseClient<Database>,
    getUser,
    insert,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('autoClockInIfEnabled', () => {
  it('uses the known auth user id and inserts an auto open shift', async () => {
    const { client, getUser, insert } = makeClient();

    await autoClockInIfEnabled(client, USER_ID);

    expect(getUser).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith({
      user_id: USER_ID,
      source: 'auto',
      created_by: USER_ID,
      updated_by: USER_ID,
    });
  });

  it('falls back to auth.getUser when no user id is supplied', async () => {
    const { client, getUser, insert } = makeClient();

    await autoClockInIfEnabled(client);

    expect(getUser).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: USER_ID }));
  });

  it('skips employees who are not opted into both tracking flags', async () => {
    const { client, insert } = makeClient({
      profile: { time_tracked: true, auto_clock_in: false, is_active: true, deleted_at: null },
    });

    await autoClockInIfEnabled(client, USER_ID);

    expect(insert).not.toHaveBeenCalled();
  });

  it('logs a failed insert instead of swallowing it silently', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = makeClient({ insertError: { code: '42501' } });

    await autoClockInIfEnabled(client, USER_ID);

    expect(errorSpy).toHaveBeenCalledWith('[time-clock] auto clock-in failed', {
      stage: 'insert',
      code: '42501',
    });
  });

  it('ignores the open-shift race where another request already clocked in', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = makeClient({ insertError: { code: '23505' } });

    await autoClockInIfEnabled(client, USER_ID);

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
