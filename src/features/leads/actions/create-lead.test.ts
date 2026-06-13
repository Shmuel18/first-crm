import { afterEach, describe, expect, it, vi } from 'vitest';

import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { createLeadAction } from './create-lead';
import { LEAD_ACTION_INITIAL } from '../types';

vi.mock('@/lib/auth/permissions', () => ({ userHasPermission: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

// Valid v4 UUIDs (Zod 4's z.uuid() checks the version/variant nibbles).
const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ADVISOR = '22222222-2222-4222-8222-222222222222';

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('first_name', 'Test');
  fd.set('last_name', 'Lead');
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

function mockSupabase(insertResult: { data: { id: string } | null; error: { code?: string } | null }) {
  const single = vi.fn(async () => insertResult);
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  const getUser = vi.fn(async () => ({ data: { user: { id: USER_ID } } }));
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser },
    from,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { from, insert };
}

afterEach(() => vi.clearAllMocks());

describe('createLeadAction', () => {
  it('logs the failure code (never the message) and returns unknown on insert error (R4-xcut-4)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(userHasPermission).mockResolvedValue(true);
    mockSupabase({ data: null, error: { code: '23505' } });

    const res = await createLeadAction(LEAD_ACTION_INITIAL, makeFormData());

    expect(res).toMatchObject({ ok: false, error: 'unknown' });
    expect(errSpy).toHaveBeenCalledWith('[createLead] insert failed', { code: '23505' });
  });

  it('forces assigned_to = self for a caller WITHOUT view_all_leads (R4-leads-1)', async () => {
    // create_lead granted, view_all_leads denied.
    vi.mocked(userHasPermission).mockImplementation(async (perm) => perm === 'create_lead');
    const { insert } = mockSupabase({ data: { id: 'lead-1' }, error: null });

    const res = await createLeadAction(LEAD_ACTION_INITIAL, makeFormData({ assigned_to: OTHER_ADVISOR }));

    expect(res).toEqual({ ok: true, leadId: 'lead-1' });
    // The chosen OTHER_ADVISOR is ignored — the lead is owned by its creator.
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ assigned_to: USER_ID }));
  });

  it('honors the chosen assignee for a view_all_leads caller', async () => {
    vi.mocked(userHasPermission).mockResolvedValue(true); // create_lead + view_all_leads
    const { insert } = mockSupabase({ data: { id: 'lead-2' }, error: null });

    await createLeadAction(LEAD_ACTION_INITIAL, makeFormData({ assigned_to: OTHER_ADVISOR }));

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ assigned_to: OTHER_ADVISOR }));
  });
});
