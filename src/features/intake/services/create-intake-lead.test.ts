import { afterEach, describe, expect, it, vi } from 'vitest';

import { getRequestIp } from '@/lib/http/request-ip';
import { checkRateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';

import { PRIVACY_POLICY_VERSION } from '../constants';
import { createIntakeLead } from './create-intake-lead';
import { sendIntakeEmails } from './intake-email';

import type { IntakeInput } from '../schemas/intake.schema';

vi.mock('@/lib/http/request-ip', () => ({ getRequestIp: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('./intake-email', () => ({ sendIntakeEmails: vi.fn() }));

const intake: IntakeInput = {
  borrowers: [{ first_name: 'Ada', last_name: 'Lovelace', email: ' ADA@Example.com ' }],
  consent: true,
  locale: 'en',
};

function mockRpc(result: { data: string | null; error: { code?: string } | null }) {
  const rpc = vi.fn(async () => result);
  vi.mocked(createAdminClient).mockReturnValue({ rpc } as unknown as ReturnType<
    typeof createAdminClient
  >);
  return rpc;
}

afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRequestIp).mockResolvedValue('1.2.3.4');
});

describe('createIntakeLead', () => {
  it('fails closed on the IP gate before checking email or touching the DB', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    await expect(createIntakeLead(intake, 'en', 'web_contact')).resolves.toEqual({
      ok: false,
      error: 'rate_limited',
    });

    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(sendIntakeEmails).not.toHaveBeenCalled();
  });

  it('fails closed on the normalized email gate before touching the DB', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(createIntakeLead(intake, 'en', 'web_contact')).resolves.toEqual({
      ok: false,
      error: 'rate_limited',
    });

    expect(checkRateLimit).toHaveBeenNthCalledWith(2, {
      action: 'web_contact',
      subject: 'email:ada@example.com',
      max: 3,
      windowSeconds: 3600,
      failMode: 'closed',
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('writes through the service-role RPC and emails only after a successful lead', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    const rpc = mockRpc({ data: 'lead-id', error: null });

    await expect(createIntakeLead(intake, 'en', 'web_contact')).resolves.toEqual({ ok: true });

    expect(checkRateLimit).toHaveBeenNthCalledWith(1, {
      action: 'web_contact',
      subject: 'ip:1.2.3.4',
      max: 5,
      windowSeconds: 3600,
      failMode: 'closed',
    });
    expect(rpc).toHaveBeenCalledWith('submit_public_intake', {
      p_payload: intake,
      p_policy_version: PRIVACY_POLICY_VERSION,
      p_ip: '1.2.3.4',
    });
    expect(sendIntakeEmails).toHaveBeenCalledWith(intake, 'en');
  });

  it('supports phone-only intake without creating an email rate-limit bucket', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    mockRpc({ data: 'lead-id', error: null });
    const phoneOnly: IntakeInput = {
      borrowers: [{ first_name: 'Ada', last_name: 'Lovelace', phone: '0501234567' }],
      consent: true,
    };

    await expect(createIntakeLead(phoneOnly, 'he', 'public_intake')).resolves.toEqual({ ok: true });

    expect(checkRateLimit).toHaveBeenCalledTimes(1);
  });

  it('does not send email when the lead RPC fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    mockRpc({ data: null, error: { code: 'XX000' } });

    await expect(createIntakeLead(intake, 'en', 'web_contact')).resolves.toEqual({
      ok: false,
      error: 'unknown',
    });

    expect(sendIntakeEmails).not.toHaveBeenCalled();
  });
});
