import { afterEach, describe, expect, it, vi } from 'vitest';

import { autoClockInIfEnabled } from '@/features/time-clock/services/auto-clock-in';
import { checkRateLimit, refundRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

import { LOGIN_INITIAL_STATE } from '../types';

import { loginAction } from './login';

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
  refundRateLimit: vi.fn(async () => undefined),
}));
vi.mock('@/lib/http/request-ip', () => ({
  getRequestIp: vi.fn(async () => '1.2.3.4'),
}));
vi.mock('@/features/time-clock/services/auto-clock-in', () => ({
  autoClockInIfEnabled: vi.fn(async () => undefined),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const LOGIN_USER_ID = '11111111-1111-4111-8111-111111111111';

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function mockSignIn(result: { error: { code?: string; message: string } | null }) {
  const signInWithPassword = vi.fn(async () => ({
    data: { user: result.error ? null : { id: LOGIN_USER_ID } },
    error: result.error,
  }));
  // Partial client fixture — the action only touches auth.signInWithPassword.
  vi.mocked(createClient).mockResolvedValue({
    auth: { signInWithPassword },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return signInWithPassword;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('loginAction lockout flow', () => {
  it('success: consumes the gates atomically but refunds the failure budgets', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    const signIn = mockSignIn({ error: null });

    await expect(
      loginAction(LOGIN_INITIAL_STATE, form({ email: 'a@b.com', password: 'Passw0rd1' })),
    ).rejects.toThrow('REDIRECT:/cases');

    expect(signIn).toHaveBeenCalledTimes(1);
    const consumed = vi.mocked(checkRateLimit).mock.calls.map((c) => c[0].action);
    expect(consumed).toEqual(['login_attempt', 'login_fail', 'login_fail_global']);
    const refunded = vi
      .mocked(refundRateLimit)
      .mock.calls.map((c) => c[0].action)
      .sort();
    expect(refunded).toEqual(['login_fail', 'login_fail_global']);
    expect(autoClockInIfEnabled).toHaveBeenCalledWith(expect.anything(), LOGIN_USER_ID);
  });

  it('bad credentials: the failure budgets stay consumed (no refund)', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    mockSignIn({
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    });

    const res = await loginAction(
      LOGIN_INITIAL_STATE,
      form({ email: 'a@b.com', password: 'wrong-pass1' }),
    );
    expect(res).toEqual({ error: 'invalid_credentials' });
    expect(refundRateLimit).not.toHaveBeenCalled();
  });

  it('lockout: a blocked failure gate stops BEFORE the password check', async () => {
    vi.mocked(checkRateLimit).mockImplementation(async ({ action }) => action !== 'login_fail');
    const signIn = mockSignIn({ error: null });

    const res = await loginAction(
      LOGIN_INITIAL_STATE,
      form({ email: 'a@b.com', password: 'whatever1' }),
    );
    expect(res).toEqual({ error: 'rate_limited' });
    expect(signIn).not.toHaveBeenCalled();
    expect(refundRateLimit).not.toHaveBeenCalled();
  });

  it('infra error: refunds the budgets and reports unknown', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    mockSignIn({ error: { code: 'unexpected_failure', message: 'upstream boom' } });

    const res = await loginAction(
      LOGIN_INITIAL_STATE,
      form({ email: 'a@b.com', password: 'whatever1' }),
    );
    expect(res).toEqual({ error: 'unknown' });
    expect(refundRateLimit).toHaveBeenCalledTimes(2);
  });

  it('rejects an unsafe next target, falling back to /cases', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    mockSignIn({ error: null });

    await expect(
      loginAction(
        LOGIN_INITIAL_STATE,
        form({ email: 'a@b.com', password: 'Passw0rd1', next: '//evil.com' }),
      ),
    ).rejects.toThrow('REDIRECT:/cases');
  });

  it('honors a same-origin next target', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    mockSignIn({ error: null });

    await expect(
      loginAction(
        LOGIN_INITIAL_STATE,
        form({ email: 'a@b.com', password: 'Passw0rd1', next: '/tasks' }),
      ),
    ).rejects.toThrow('REDIRECT:/tasks');
  });

  it('invalid input never touches the rate limiter', async () => {
    const res = await loginAction(
      LOGIN_INITIAL_STATE,
      form({ email: 'not-an-email', password: '' }),
    );
    expect(res).toEqual({ error: 'invalid_input' });
    expect(checkRateLimit).not.toHaveBeenCalled();
  });
});
