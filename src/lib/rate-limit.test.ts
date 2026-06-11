import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAdminClient } from '@/lib/supabase/admin';

import { checkRateLimit, refundRateLimit } from './rate-limit';

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

function mockRpc(result: {
  data?: unknown;
  error?: { code?: string; message: string } | null;
}) {
  const rpc = vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null }));
  // Partial client fixture — the wrappers only call rpc().
  vi.mocked(createAdminClient).mockReturnValue({ rpc } as unknown as ReturnType<
    typeof createAdminClient
  >);
  return rpc;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('checkRateLimit', () => {
  it('allows while the RPC reports under-limit and passes the args through', async () => {
    const rpc = mockRpc({ data: true });
    await expect(
      checkRateLimit({ action: 'a', subject: 's', max: 5, windowSeconds: 60 }),
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('consume_rate_limit', {
      p_action: 'a',
      p_subject: 's',
      p_max: 5,
      p_window_seconds: 60,
    });
  });

  it('refuses once over the limit', async () => {
    mockRpc({ data: false });
    await expect(
      checkRateLimit({ action: 'a', subject: 's', max: 5, windowSeconds: 60 }),
    ).resolves.toBe(false);
  });

  it('fail-closed refuses on RPC error; fail-open allows', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRpc({ error: { code: 'XX000', message: 'boom' } });
    await expect(
      checkRateLimit({ action: 'a', subject: 's', max: 1, windowSeconds: 60, failMode: 'closed' }),
    ).resolves.toBe(false);
    mockRpc({ error: { code: 'XX000', message: 'boom' } });
    await expect(
      checkRateLimit({ action: 'a', subject: 's', max: 1, windowSeconds: 60, failMode: 'open' }),
    ).resolves.toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('refundRateLimit', () => {
  it('decrements via the RPC with the caller args', async () => {
    const rpc = mockRpc({});
    await refundRateLimit({
      action: 'login_fail',
      subject: 'email:a@b.com:ip:1.2.3.4',
      windowSeconds: 900,
    });
    expect(rpc).toHaveBeenCalledWith('refund_rate_limit', {
      p_action: 'login_fail',
      p_subject: 'email:a@b.com:ip:1.2.3.4',
      p_window_seconds: 900,
    });
  });

  it('never throws — a missing RPC (migration 164 not applied) is logged and swallowed', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRpc({ error: { code: 'PGRST202', message: 'function not found in schema cache' } });
    await expect(
      refundRateLimit({ action: 'login_fail', subject: 's', windowSeconds: 900 }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
