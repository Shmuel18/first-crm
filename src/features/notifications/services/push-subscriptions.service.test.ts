import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/lib/supabase/admin';

import { deletePushSubscriptionByEndpoint } from './push-subscriptions.service';

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

/** Chainable delete().eq().eq() recorder that resolves to a no-error result. */
function mockTable() {
  const eqCalls: Array<[string, unknown]> = [];
  const builder = {
    delete: vi.fn(() => builder),
    eq: vi.fn((col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return builder;
    }),
    then: (resolve: (v: { error: null }) => unknown) => resolve({ error: null }),
  };
  const from = vi.fn(() => builder);
  vi.mocked(createAdminClient).mockReturnValue({ from } as unknown as ReturnType<
    typeof createAdminClient
  >);
  return { from, eqCalls };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deletePushSubscriptionByEndpoint — ownership scoping (R2-notif-1)', () => {
  it('filters by BOTH endpoint and user_id (admin client bypasses RLS)', async () => {
    const { from, eqCalls } = mockTable();

    await deletePushSubscriptionByEndpoint('https://push.example/abc', 'user-123');

    expect(from).toHaveBeenCalledWith('push_subscriptions');
    expect(eqCalls).toContainEqual(['endpoint', 'https://push.example/abc']);
    // The user_id filter is the authorization boundary — without it any
    // authenticated caller could delete another user's subscription by endpoint.
    expect(eqCalls).toContainEqual(['user_id', 'user-123']);
  });
});
