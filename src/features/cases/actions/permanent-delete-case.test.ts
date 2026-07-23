import { afterEach, describe, expect, it, vi } from 'vitest';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { permanentDeleteCaseAction } from './permanent-delete-case';
import { collectCaseFileRefs, eraseCaseFiles } from '../services/erase-case-files';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
// The action defers file erasure via next/server's after(), which throws
// (E468) outside a request scope. Run the callback inline so the "erases only
// after a confirmed delete" assertion still exercises the real call.
vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }));
vi.mock('@/lib/auth/permissions', () => ({ isCurrentUserAdmin: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('../services/erase-case-files', () => ({
  collectCaseFileRefs: vi.fn(),
  eraseCaseFiles: vi.fn(),
}));

const INPUT = { caseId: 'case-1', confirmCaseNumber: 'K-100' };

function mockRpc(result: { data: unknown; error: { code?: string } | null }) {
  const rpc = vi.fn(async () => result);
  vi.mocked(createClient).mockResolvedValue({ rpc } as unknown as Awaited<
    ReturnType<typeof createClient>
  >);
  return rpc;
}

afterEach(() => vi.clearAllMocks());

describe('permanentDeleteCaseAction', () => {
  it('ABORTS without deleting when file-ref collection fails (R5-lifecycle-2 follow-up)', async () => {
    vi.mocked(isCurrentUserAdmin).mockResolvedValue(true);
    vi.mocked(collectCaseFileRefs).mockResolvedValue({ ok: false });
    const rpc = mockRpc({ data: null, error: null });

    const res = await permanentDeleteCaseAction(INPUT);

    expect(res).toEqual({ ok: false, error: 'unknown' });
    expect(rpc).not.toHaveBeenCalled(); // never hard-deletes
    expect(eraseCaseFiles).not.toHaveBeenCalled();
  });

  it('maps the retention-guard PT001 to retention_paused', async () => {
    vi.mocked(isCurrentUserAdmin).mockResolvedValue(true);
    vi.mocked(collectCaseFileRefs).mockResolvedValue({
      ok: true,
      refs: { pointers: [], caseFolderId: null },
    });
    mockRpc({ data: null, error: { code: 'PT001' } });

    await expect(permanentDeleteCaseAction(INPUT)).resolves.toEqual({
      ok: false,
      error: 'retention_paused',
    });
    expect(eraseCaseFiles).not.toHaveBeenCalled();
  });

  it('erases files only after a confirmed delete', async () => {
    vi.mocked(isCurrentUserAdmin).mockResolvedValue(true);
    const refs = { pointers: [], caseFolderId: null };
    vi.mocked(collectCaseFileRefs).mockResolvedValue({ ok: true, refs });
    mockRpc({ data: true, error: null });

    await expect(permanentDeleteCaseAction(INPUT)).resolves.toEqual({ ok: true });
    expect(eraseCaseFiles).toHaveBeenCalledWith('case-1', refs);
  });
});
